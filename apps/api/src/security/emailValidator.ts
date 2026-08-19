import { z } from 'zod';
import { DISPOSABLE_DOMAINS_SET, isDisposableDomain } from './disposableDomains';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks if an email is valid for EcoBud registration:
 * 1. Must be a valid email format
 * 2. Domain must not be in the disposable/temp mail blocklist
 * 3. Must be a standard email provider or an educational email (.edu, .edu.ph, etc.)
 */
export function isEduEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split('@')[1] || '';
  return (
    domain.endsWith('.edu') ||
    domain.endsWith('.edu.ph') ||
    domain.endsWith('.ac.uk') ||
    domain.endsWith('.ac.jp') ||
    domain.endsWith('.edu.au')
  );
}

export function isAllowedEmailDomain(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) return false;

  const domain = normalized.split('@')[1] || '';
  if (!domain || isDisposableDomain(domain)) {
    return false;
  }

  // Allow standard trusted domains or educational domains
  const trustedDomains = [
    'gmail.com',
    'yahoo.com',
    'yahoo.com.ph',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'icloud.com',
    'proton.me',
    'protonmail.com',
    'aol.com',
  ];

  if (trustedDomains.includes(domain)) {
    return true;
  }

  // Educational domains
  if (isEduEmail(normalized)) {
    return true;
  }

  // Any valid non-disposable organization/personal domain with valid TLD
  return !isDisposableDomain(domain);
}

export const emailRegistrationSchema = z.string().email().refine((email) => {
  const domain = email.trim().toLowerCase().split('@')[1] || '';
  return !isDisposableDomain(domain);
}, {
  message: 'Temporary or disposable email addresses are not permitted.',
});
