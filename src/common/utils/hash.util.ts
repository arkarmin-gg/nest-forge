import * as crypto from 'crypto';

/**
 * Returns the hex-encoded SHA-256 digest of the given value.
 *
 * Used to store refresh tokens and OTP codes as one-way hashes so a database
 * leak does not expose active sessions or verification codes.
 */
export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
