import { Injectable, BadRequestException } from '@nestjs/common';
import { randomBytes, createHmac } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';

/**
 * MFA TOTP service — implements RFC 6238 TOTP.
 * Enrollment generates a secret + recovery codes.
 * Verification validates a 6-digit code against the shared secret.
 */
@Injectable()
export class MfaService {
  private readonly TOTP_DIGITS = 6;
  private readonly TOTP_PERIOD = 30; // seconds
  private readonly TOTP_WINDOW = 1; // allow ±1 period drift

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Enroll user in MFA. Returns secret (base32) and recovery codes.
   */
  async enroll(userId: string): Promise<{ secret: string; otpAuthUrl: string; recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.mfaEnabled) throw new BadRequestException('MFA already enabled');

    // Generate 20-byte secret
    const secretBuffer = randomBytes(20);
    const secret = this.toBase32(secretBuffer);

    // Generate 10 recovery codes
    const recoveryCodes = Array.from({ length: 10 }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );

    // Store secret (in production, this should be encrypted)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: `${secret}:${recoveryCodes.join(',')}` },
    });

    const otpAuthUrl = `otpauth://totp/OpenMusic:${user.email}?secret=${secret}&issuer=OpenMusic&digits=${this.TOTP_DIGITS}&period=${this.TOTP_PERIOD}`;

    await this.auditLog.log({
      userId,
      action: 'mfa_enroll',
      resource: 'user',
      resourceId: userId,
    });

    return { secret, otpAuthUrl, recoveryCodes };
  }

  /**
   * Verify TOTP code and enable MFA if first-time verification.
   */
  async verify(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) throw new BadRequestException('MFA not enrolled');

    const [secret] = user.mfaSecret.split(':');
    if (!secret) throw new BadRequestException('Invalid MFA secret');

    const secretBuffer = this.fromBase32(secret);
    const now = Math.floor(Date.now() / 1000);

    // Check current period and window
    for (let i = -this.TOTP_WINDOW; i <= this.TOTP_WINDOW; i++) {
      const counter = Math.floor((now + i * this.TOTP_PERIOD) / this.TOTP_PERIOD);
      const expected = this.generateTOTP(secretBuffer, counter);
      if (expected === code) {
        // Enable MFA on first successful verification
        if (!user.mfaEnabled) {
          await this.prisma.user.update({
            where: { id: userId },
            data: { mfaEnabled: true },
          });
        }

        await this.auditLog.log({
          userId,
          action: 'mfa_verify_success',
          resource: 'user',
          resourceId: userId,
        });

        return true;
      }
    }

    await this.auditLog.log({
      userId,
      action: 'mfa_verify_failure',
      resource: 'user',
      resourceId: userId,
    });

    return false;
  }

  /**
   * Disable MFA for user.
   */
  async disable(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    await this.auditLog.log({
      userId,
      action: 'mfa_disable',
      resource: 'user',
      resourceId: userId,
    });
  }

  // ─── Private TOTP helpers ──────────────────────────────────────────────────

  private generateTOTP(secret: Buffer, counter: number): string {
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));

    const hmac = createHmac('sha1', secret).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const code =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);

    return (code % 10 ** this.TOTP_DIGITS).toString().padStart(this.TOTP_DIGITS, '0');
  }

  private toBase32(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const byte of buffer) {
      bits += byte.toString(2).padStart(8, '0');
    }
    let result = '';
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.slice(i, i + 5).padEnd(5, '0');
      result += alphabet[parseInt(chunk, 2)];
    }
    return result;
  }

  private fromBase32(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const char of encoded.toUpperCase()) {
      const idx = alphabet.indexOf(char);
      if (idx === -1) continue;
      bits += idx.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
  }
}
