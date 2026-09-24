import crypto from 'crypto';
import { HttpError } from '../http/errorResponder';
import { JWT_SECRET } from './tokenService';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ISSUER = 'ECOBUD';
const STEP_SECONDS = 30;

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

function decodeBase32(secret: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of secret.toUpperCase().replace(/=+$/g, '')) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new HttpError(400, 'Authenticator setup expired. Start setup again.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function encryptionKey(): Buffer {
  const configured = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (configured) {
    const key = /^[a-f0-9]{64}$/i.test(configured) ? Buffer.from(configured, 'hex') : Buffer.from(configured, 'base64');
    if (key.length === 32) return key;
    throw new Error('TOTP_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters or base64.');
  }
  if (process.env.NODE_ENV === 'production') throw new HttpError(503, 'Authenticator verification is not configured on this server.');
  return crypto.createHash('sha256').update(JWT_SECRET).digest();
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptTotpSecret(value: string): string {
  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted authenticator secret.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const currentStep = Math.floor(now / 1000 / STEP_SECONDS);
  for (const step of [currentStep - 1, currentStep, currentStep + 1]) {
    const expected = totpAt(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return step;
  }
  return null;
}

export function createTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

export function createTotpUri(email: string, secret: string) {
  const uri = `otpauth://totp/${encodeURIComponent(`${ISSUER}:${email}`)}?secret=${secret}&issuer=${ISSUER}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
  return uri;
}

export function makeRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => encodeBase32(crypto.randomBytes(8)).slice(0, 13));
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHmac('sha256', JWT_SECRET)
    .update(code.replace(/[-\s]/g, '').toUpperCase()).digest('hex');
}
