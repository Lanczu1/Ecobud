/**
 * Comprehensive blocklist of common disposable / temporary email domains.
 */
export const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'mailinator.com',
  'mailinator2.com',
  '10minutemail.com',
  '10minutemail.net',
  '10minmail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'trashmail.com',
  'trashmail.net',
  'trashmail.me',
  'dispostable.com',
  'getairmail.com',
  'throwawaymail.com',
  'sharklasers.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.de',
  'spam4.me',
  'fakemailgenerator.com',
  'emailondeck.com',
  'mohmal.com',
  'crazymailing.com',
  'inboxkitten.com',
  'generator.email',
  'tempail.com',
  'maildrop.cc',
  'discard.email',
  'discardmail.com',
  'spambog.com',
  'nada.ltd',
  'getnada.com',
  'abcvg.com',
  'mytemp.email',
  'mintemail.com',
  'fakeinbox.com',
  'mytempemail.com',
  'burnermail.io',
  'dropmail.me',
  'zillamail.com',
  'mailcatch.com',
  'harakirimail.com',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'teleworm.us',
  'einrot.com',
  'byom.de',
];

export const DISPOSABLE_DOMAINS_SET = new Set(DISPOSABLE_EMAIL_DOMAINS);

export function isDisposableDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  if (DISPOSABLE_DOMAINS_SET.has(normalized)) return true;

  // Pattern matching for typical temp mail keywords
  if (
    normalized.includes('tempmail') ||
    normalized.includes('disposable') ||
    normalized.includes('throwaway') ||
    normalized.includes('10minute') ||
    normalized.includes('trashmail') ||
    normalized.includes('fakeinbox') ||
    normalized.includes('guerrillamail')
  ) {
    return true;
  }

  return false;
}
