/**
 * KMS Client abstraction — pluggable backends for envelope encryption.
 * Implementations: AWS KMS, HashiCorp Vault Transit, LocalStack (dev).
 */

export interface DataKeyResult {
  /** Plaintext DEK — used for AES-256-GCM encryption, then discarded from memory */
  plaintext: Buffer;
  /** Ciphertext DEK — stored in DB alongside encrypted data */
  ciphertextBlob: Buffer;
  /** Key ID reference in KMS */
  keyId: string;
}

export interface KmsClient {
  /**
   * Generate a new Data Encryption Key (DEK).
   * KMS encrypts the DEK with the master key (KEK) and returns both forms.
   */
  generateDataKey(keyAlias: string): Promise<DataKeyResult>;

  /**
   * Decrypt a previously encrypted DEK using the KMS master key.
   */
  decrypt(ciphertextBlob: Buffer, keyId: string): Promise<Buffer>;

  /**
   * Encrypt plaintext directly with the master key (for small payloads).
   */
  encrypt(plaintext: Buffer, keyAlias: string): Promise<Buffer>;

  /**
   * Check KMS health/connectivity.
   */
  ping(): Promise<boolean>;
}
