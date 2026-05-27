import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes, createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  userId: string;
  role: string;
  mfaCompleted: boolean;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: Uint8Array;
  private readonly jwtExpiresIn: string;
  private readonly refreshTokenTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = new TextEncoder().encode(this.config.get<string>('JWT_SECRET'));
    this.jwtExpiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '15m';
    this.refreshTokenTtlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS') ?? 30;
  }

  async register(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64MB
      timeCost: 3,
      parallelism: 1,
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'listener',
        privacySetting: { create: {} },
      },
    });

    return this.generateTokens(user.id, user.role, false);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // If MFA is enabled, don't set mfaCompleted until verified
    const mfaCompleted = !user.mfaEnabled;

    return this.generateTokens(user.id, user.role, mfaCompleted);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(stored.user.id, stored.user.role, true);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, mfaEnabled: true, createdAt: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      return {
        userId: payload.userId as string,
        role: payload.role as string,
        mfaCompleted: payload.mfaCompleted as boolean,
      };
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async generateTokens(userId: string, role: string, mfaCompleted: boolean) {
    const accessToken = await new SignJWT({ userId, role, mfaCompleted })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.jwtExpiresIn)
      .sign(this.jwtSecret);

    const refreshToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken, expiresAt };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
