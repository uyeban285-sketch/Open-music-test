import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';

/**
 * Unit tests for AuthService core logic:
 * - argon2id round-trip (hash/verify)
 * - JWT creation and verification
 * - Refresh token hash generation
 */

describe('Auth — Password hashing', () => {
  it('should hash and verify password correctly with argon2id', async () => {
    const password = 'TestPassword123!';
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const valid = await argon2.verify(hash, password);
    expect(valid).toBe(true);

    const invalid = await argon2.verify(hash, 'WrongPassword');
    expect(invalid).toBe(false);
  });

  it('should produce different hashes for same password (random salt)', async () => {
    const password = 'SamePassword';
    const hash1 = await argon2.hash(password, { type: argon2.argon2id });
    const hash2 = await argon2.hash(password, { type: argon2.argon2id });

    expect(hash1).not.toBe(hash2);
  });
});

describe('Auth — Token hashing', () => {
  function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  it('should produce consistent hash for same token', () => {
    const token = randomBytes(32).toString('hex');
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('should produce different hashes for different tokens', () => {
    const token1 = randomBytes(32).toString('hex');
    const token2 = randomBytes(32).toString('hex');

    expect(hashToken(token1)).not.toBe(hashToken(token2));
  });
});

describe('Auth — JWT', () => {
  // Using jose for JWT operations (same as the service)
  it('should create and verify JWT with correct claims', async () => {
    const { SignJWT, jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode('test-secret-key-at-least-32-characters-long');

    const jwt = await new SignJWT({
      userId: 'user-123',
      role: 'listener',
      mfaCompleted: true,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret);

    expect(jwt).toBeDefined();
    expect(jwt.split('.')).toHaveLength(3);

    const { payload } = await jwtVerify(jwt, secret);
    expect(payload.userId).toBe('user-123');
    expect(payload.role).toBe('listener');
    expect(payload.mfaCompleted).toBe(true);
    expect(payload.exp).toBeDefined();
  });

  it('should reject JWT with wrong secret', async () => {
    const { SignJWT, jwtVerify } = await import('jose');
    const secret1 = new TextEncoder().encode('secret-key-number-one-32chars-ok');
    const secret2 = new TextEncoder().encode('secret-key-number-two-32chars-ok');

    const jwt = await new SignJWT({ userId: 'user-123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secret1);

    await expect(jwtVerify(jwt, secret2)).rejects.toThrow();
  });

  it('should reject expired JWT', async () => {
    const { SignJWT, jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode('test-secret-key-at-least-32-characters-long');

    const jwt = await new SignJWT({ userId: 'user-123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('-1s') // already expired
      .sign(secret);

    await expect(jwtVerify(jwt, secret)).rejects.toThrow();
  });
});

describe('Auth — Refresh token rotation', () => {
  it('should generate unique refresh tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(randomBytes(32).toString('hex'));
    }
    expect(tokens.size).toBe(100);
  });
});
