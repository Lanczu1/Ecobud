import type { Request } from 'express';
import { prisma } from '../prismaClient';

// Every authentication event is stored in audit_logs with this prefix. Admin
// views and "clear audit logs" filter on it, so these rows stay out of the
// admin activity screens and cannot be wiped from the dashboard.
export const AUTH_AUDIT_PREFIX = 'AUTH_';

export type AuthAuditAction =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_MFA_CHALLENGE'
  | 'AUTH_LOCKOUT'
  | 'AUTH_LOCKED_ATTEMPT'
  | 'AUTH_MFA_ENABLED'
  | 'AUTH_MFA_DISABLED'
  | 'AUTH_MFA_RECOVERY_ROTATED'
  | 'AUTH_PASSWORD_RESET'
  | 'AUTH_PASSWORD_CHANGED'
  | 'AUTH_EMAIL_CHANGED';

export type AuthMethod = 'password' | 'google' | 'mfa_totp' | 'mfa_recovery';

interface AuthAuditInput {
  userId?: string | null;
  // Only kept (masked) when no account matches, to spot targeted guessing.
  email?: string;
  method?: AuthMethod;
  reason?: string;
  newAccount?: boolean;
}

// Failure and lockout lines also go to stdout so log alerts can match them.
const CONSOLE_ACTIONS = new Set<AuthAuditAction>(['AUTH_LOGIN_FAILED', 'AUTH_LOCKOUT', 'AUTH_LOCKED_ATTEMPT']);

const maskEmail = (email: string) => {
  const [local, domain = ''] = email.trim().toLowerCase().split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

/**
 * Records an authentication event without ever blocking or failing the request.
 * Never pass passwords, codes or tokens in `input`.
 */
export function recordAuthEvent(req: Request, action: AuthAuditAction, input: AuthAuditInput = {}): void {
  const details = {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 200) ?? null,
    method: input.method,
    reason: input.reason,
    newAccount: input.newAccount || undefined,
    email: !input.userId && input.email ? maskEmail(input.email) : undefined,
  };

  if (CONSOLE_ACTIONS.has(action)) {
    console.warn(JSON.stringify({ event: 'auth_event', action, userId: input.userId ?? null, ...details, timestamp: new Date().toISOString() }));
  }

  void prisma.auditLog
    .create({ data: { action, userId: input.userId ?? null, details: JSON.stringify(details) } })
    .catch((error: unknown) => {
      const code = (error as { code?: string } | null)?.code;
      const message = error instanceof Error ? error.message.trim().split('\n').pop()?.trim() : undefined;
      console.error(JSON.stringify({ event: 'auth_audit_write_failed', action, code, error: message || 'unknown' }));
    });
}
