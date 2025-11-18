import crypto from 'crypto';

/**
 * Encryption Utilities for Sensitive Data
 *
 * Uses AES-256-GCM for symmetric encryption
 * Encrypts sensitive data like tax codes, bank info, etc.
 */

// Get encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM mode

/**
 * Ensure encryption key is valid
 */
function getEncryptionKey(): Buffer {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('⚠️  ENCRYPTION_KEY not set in .env, using random key (data will not persist across restarts)');
  }

  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }

  return key;
}

/**
 * Encrypt sensitive data
 *
 * @param text - Plain text to encrypt
 * @returns Encrypted data in format: iv:authTag:encryptedData (all hex encoded)
 */
export function encrypt(text: string): string {
  if (!text) return '';

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 *
 * @param encryptedData - Encrypted data in format: iv:authTag:encryptedData
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash sensitive data for comparison (one-way)
 * Use for data that doesn't need to be decrypted but needs to be compared
 *
 * @param text - Text to hash
 * @returns SHA-256 hash
 */
export function hashData(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Generate random encryption key (for initial setup)
 *
 * @returns 32-byte key as hex string
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Encrypt object fields selectively
 *
 * @param obj - Object to encrypt
 * @param fields - Array of field names to encrypt
 * @returns New object with encrypted fields
 */
export function encryptFields<T extends Record<string, any>>(obj: T, fields: string[]): T {
  const result = { ...obj } as any;

  fields.forEach((field) => {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encrypt(result[field]);
    }
  });

  return result;
}

/**
 * Decrypt object fields selectively
 *
 * @param obj - Object to decrypt
 * @param fields - Array of field names to decrypt
 * @returns New object with decrypted fields
 */
export function decryptFields<T extends Record<string, any>>(obj: T, fields: string[]): T {
  const result = { ...obj } as any;

  fields.forEach((field) => {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = decrypt(result[field]);
      } catch (error) {
        console.warn(`Failed to decrypt field "${field}":`, error);
      }
    }
  });

  return result;
}

export default {
  encrypt,
  decrypt,
  hashData,
  generateEncryptionKey,
  encryptFields,
  decryptFields,
};
