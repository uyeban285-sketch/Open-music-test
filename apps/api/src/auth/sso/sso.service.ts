import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';

interface SsoState {
  provider: string;
  userId?: string;
  nonce: string;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface UserInfo {
  email: string;
  name?: string;
  picture?: string;
  sub: string;
}

/**
 * SSO Service — handles OAuth 2.0 / OIDC flows for Google and Yandex.
 * State is signed JWT with TTL to prevent CSRF.
 */
@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private readonly jwtSecret: Uint8Array;

  private readonly providers: Record<string, {
    authUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    clientId: string;
    clientSecret: string;
    scopes: string[];
  }>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {
    this.jwtSecret = new TextEncoder().encode(
      this.config.get<string>('JWT_SECRET') ?? 'sso-state-secret-32chars-padded!',
    );

    this.providers = {
      google: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
        clientId: this.config.get<string>('GOOGLE_CLIENT_ID') ?? '',
        clientSecret: this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
        scopes: ['openid', 'email', 'profile'],
      },
      yandex: {
        authUrl: 'https://oauth.yandex.ru/authorize',
        tokenUrl: 'https://oauth.yandex.ru/token',
        userInfoUrl: 'https://login.yandex.ru/info',
        clientId: this.config.get<string>('YANDEX_CLIENT_ID') ?? '',
        clientSecret: this.config.get<string>('YANDEX_CLIENT_SECRET') ?? '',
        scopes: ['login:email', 'login:info'],
      },
    };
  }

  /**
   * Generate OAuth authorization URL with signed state.
   */
  async startAuth(provider: string, userId?: string): Promise<{ redirectUrl: string; state: string }> {
    const providerConfig = this.providers[provider];
    if (!providerConfig) throw new BadRequestException(`Unknown SSO provider: ${provider}`);

    const nonce = crypto.randomUUID();

    // Create signed state JWT (5 min TTL)
    const state = await new SignJWT({ provider, userId, nonce } satisfies SsoState)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(this.jwtSecret);

    const params = new URLSearchParams({
      client_id: providerConfig.clientId,
      redirect_uri: this.getCallbackUrl(provider),
      response_type: 'code',
      scope: providerConfig.scopes.join(' '),
      state,
    });

    if (provider === 'google') {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    }

    const redirectUrl = `${providerConfig.authUrl}?${params.toString()}`;
    return { redirectUrl, state };
  }

  /**
   * Handle OAuth callback — exchange code for tokens and link/create user.
   */
  async handleCallback(provider: string, code: string, state: string): Promise<{ userId: string; isNew: boolean }> {
    // Verify state JWT
    const { payload } = await jwtVerify(state, this.jwtSecret).catch(() => {
      throw new BadRequestException('Invalid or expired SSO state');
    });

    if (payload.provider !== provider) {
      throw new BadRequestException('SSO state provider mismatch');
    }

    const providerConfig = this.providers[provider];
    if (!providerConfig) throw new BadRequestException(`Unknown SSO provider: ${provider}`);

    // Exchange code for tokens
    const tokens = await this.exchangeCode(provider, code);

    // Get user info
    const userInfo = await this.getUserInfo(provider, tokens.access_token);

    if (!userInfo.email) {
      throw new BadRequestException('SSO provider did not return email');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({ where: { email: userInfo.email } });
    let isNew = false;

    if (!user) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: userInfo.email,
          ssoProvider: provider,
          role: 'listener',
          privacySetting: { create: {} },
        },
      });
      isNew = true;
    } else if (!user.ssoProvider) {
      // Link SSO to existing user
      await this.prisma.user.update({
        where: { id: user.id },
        data: { ssoProvider: provider },
      });
    }

    await this.auditLog.log({
      userId: user.id,
      action: isNew ? 'sso_register' : 'sso_login',
      resource: 'user',
      resourceId: user.id,
      metadata: { provider, sub: userInfo.sub },
    });

    return { userId: user.id, isNew };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async exchangeCode(provider: string, code: string): Promise<OAuthTokenResponse> {
    const providerConfig = this.providers[provider]!;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      redirect_uri: this.getCallbackUrl(provider),
    });

    const response = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`SSO token exchange failed for ${provider}: ${error}`);
      throw new BadRequestException('SSO token exchange failed');
    }

    return response.json() as Promise<OAuthTokenResponse>;
  }

  private async getUserInfo(provider: string, accessToken: string): Promise<UserInfo> {
    const providerConfig = this.providers[provider]!;
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };

    // Yandex uses different format
    const url = provider === 'yandex'
      ? `${providerConfig.userInfoUrl}?format=json`
      : providerConfig.userInfoUrl;

    const response = await fetch(url, { headers });
    if (!response.ok) throw new BadRequestException('Failed to get SSO user info');

    const data = await response.json();

    if (provider === 'yandex') {
      return {
        email: data.default_email ?? data.emails?.[0],
        name: data.display_name ?? data.real_name,
        sub: data.id,
      };
    }

    return data as UserInfo;
  }

  private getCallbackUrl(provider: string): string {
    const baseUrl = this.config.get<string>('API_BASE_URL') ?? 'http://localhost:4000';
    return `${baseUrl}/auth/oauth/${provider}/callback`;
  }
}
