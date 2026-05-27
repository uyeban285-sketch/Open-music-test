import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

import { DataKeyResult, KmsClient } from './kms-client.interface';

/**
 * Mock KMS client for local development using LocalStack or pure in-memory.
 * In dev mode, uses a static master key derived from env for simplicity.
 * In production, this is replaced with AWS KMS or Vault Transit.
 */
@Injectable()
export class KmsLocalstackClient implements KmsClient {
  private readonly masterKey: Buffer;

  constructor(private readonly config: ConfigService) {
    // In dev, derive a deterministic 32-byte key from JWT_SECRET (or env)
    const secret = this.config.get<string>('JWT_SECRET') ?? 'dev-master-key-32-chars-padding!';
    this.masterKey = Buffer.from(secret.slice(0, 32).padEnd(32, '0'));
  }

  async generateDataKey(_keyAlias: string): Promise<DataKeyResult> {
    // Generate random 32-byte DEK
    const plaintext = randomBytes(32);

    // Encrypt DEK with master key (envelope encryption)
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Store IV + authTag + ciphertext together
    const ciphertextBlob = Buffer.concat([iv, authTag, encrypted]);

    return {
      plaintext,
      ciphertextBlob,
      keyId: 'local-dev-key',
    };
  }

  async decrypt(ciphertextBlob: Buffer, _keyId: string): Promise<Buffer> {
    const iv = ciphertextBlob.subarray(0, 12);
    const authTag = ciphertextBlob.subarray(12, 28);
    const encrypted = ciphertextBlob.subarray(28);

    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  async encrypt(plaintext: Buffer, _keyAlias: string): Promise<Buffer> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  async ping(): Promise<boolean> {
    return true;
  }
}
