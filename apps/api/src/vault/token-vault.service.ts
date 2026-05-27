import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import { KmsClient } from './kms-client.interface';

export interface WrappedToken {
  accessTokenCt: Buffer;
  refreshTokenCt: Buffer | null;
  dekId: string;
  nonce: Buffer;
  expiresAt: Date;
  scope: string[];
}

/**
 * TokenVaultService — handles envelope encryption of External_Service tokens.
 *
 * Flow:
 * 1. wrap(): Generate DEK via KMS → encrypt tokens with DEK (AES-256-GCM) → store encrypted DEK + encrypted tokens
 * 2. unwrap(): Retrieve encrypted DEK from DB → decrypt DEK via KMS → decrypt tokens → audit log
 */
@Injectable()
export class TokenVaultService {
  private readonly logger = new Logger(TokenVaultService.name);

  constructor(
    private readonly kms: KmsClient,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Encrypt and store tokens for a connected service.
   */
  async wrap(
    connectedServiceId: string,
    accessToken: string,
    refreshToken: string | null,
    expiresAt: Date,
    scope: string[],
    userId: string,
  ): Promise<void> {
    // Generate DEK via KMS
    const { plaintext: dek, ciphertextBlob: encryptedDek, keyId } =
      await this.kms.generateDataKey('open-music/tokens');

    // Encrypt access token
    const nonce = randomBytes(12);
    const accessTokenCt = this.encryptWithDek(dek, nonce, Buffer.from(accessToken, 'utf-8'));

    // Encrypt refresh token (if present)
    let refreshTokenCt: Buffer | null = null;
    if (refreshToken) {
      const refreshNonce = randomBytes(12);
      refreshTokenCt = Buffer.concat([
        refreshNonce,
        this.encryptWithDek(dek, refreshNonce, Buffer.from(refreshToken, 'utf-8')),
      ]);
    }

    // Upsert external account
    await this.prisma.externalAccount.upsert({
      where: { connectedServiceId },
      update: {
        accessTokenCt,
        refreshTokenCt,
        dekId: `${keyId}:${encryptedDek.toString('base64')}`,
        nonce,
        expiresAt,
        scope,
      },
      create: {
        connectedServiceId,
        accessTokenCt,
        refreshTokenCt,
        dekId: `${keyId}:${encryptedDek.toString('base64')}`,
        nonce,
        expiresAt,
        scope,
      },
    });

    // Zero out DEK from memory
    dek.fill(0);

    this.logger.log(`Tokens wrapped for connectedService=${connectedServiceId}`);
  }

  /**
   * Decrypt tokens for a connected service. Every unwrap is audited.
   */
  async unwrap(
    connectedServiceId: string,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date }> {
    const account = await this.prisma.externalAccount.findUnique({
      where: { connectedServiceId },
    });

    if (!account) {
      throw new Error(`No external account found for connectedServiceId=${connectedServiceId}`);
    }

    // Parse DEK info
    const [keyId, encryptedDekB64] = account.dekId.split(':');
    if (!keyId || !encryptedDekB64) {
      throw new Error('Invalid dekId format');
    }
    const encryptedDek = Buffer.from(encryptedDekB64, 'base64');

    // Decrypt DEK via KMS
    const dek = await this.kms.decrypt(encryptedDek, keyId);

    // Decrypt access token
    const accessToken = this.decryptWithDek(dek, account.nonce, account.accessTokenCt).toString(
      'utf-8',
    );

    // Decrypt refresh token (if present)
    let refreshToken: string | null = null;
    if (account.refreshTokenCt) {
      const refreshNonce = account.refreshTokenCt.subarray(0, 12);
      const refreshCt = account.refreshTokenCt.subarray(12);
      refreshToken = this.decryptWithDek(dek, refreshNonce, refreshCt).toString('utf-8');
    }

    // Zero out DEK
    dek.fill(0);

    // Audit the unwrap operation
    await this.auditLog.log({
      userId,
      action: 'token_unwrap',
      resource: 'external_account',
      resourceId: connectedServiceId,
    });

    return { accessToken, refreshToken, expiresAt: account.expiresAt };
  }

  /**
   * Revoke (delete) stored tokens for a connected service.
   */
  async revoke(connectedServiceId: string, userId: string): Promise<void> {
    await this.prisma.externalAccount.delete({
      where: { connectedServiceId },
    });

    await this.auditLog.log({
      userId,
      action: 'token_revoke',
      resource: 'external_account',
      resourceId: connectedServiceId,
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private encryptWithDek(dek: Buffer, nonce: Buffer, plaintext: Buffer): Buffer {
    const cipher = createCipheriv('aes-256-gcm', dek, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([authTag, encrypted]);
  }

  private decryptWithDek(dek: Buffer, nonce: Buffer, ciphertext: Buffer): Buffer {
    const authTag = ciphertext.subarray(0, 16);
    const encrypted = ciphertext.subarray(16);
    const decipher = createDecipheriv('aes-256-gcm', dek, nonce);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}
