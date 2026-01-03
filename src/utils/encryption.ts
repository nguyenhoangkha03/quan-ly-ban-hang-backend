import crypto from 'crypto';

// Generate random encryption key (for initial setup)
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export default {
  generateEncryptionKey,
};
