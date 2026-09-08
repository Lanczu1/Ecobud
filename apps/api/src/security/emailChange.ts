import { createHmac, randomInt } from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '../prismaClient';
import { JWT_SECRET } from './tokenService';
import { HttpError } from '../http/errorResponder';

export const emailChangeKey = (userId: string, email: string) => `change:${userId}:${email}`;
export const emailCodeHash = (key: string, code: string) => createHmac('sha256', JWT_SECRET).update(`${key}:${code}`).digest('hex');
export async function sendEmailChangeCode(userId: string, email: string) {
  const key = emailChangeKey(userId, email);
  const code = randomInt(100000, 1000000).toString();
  const hash = emailCodeHash(key, code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.otpCode.upsert({ where: { email: key }, create: { email: key, code: hash, expiresAt }, update: { code: hash, expiresAt, attempts: 0 } });
  try {
    await nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS } }).sendMail({
      from: process.env.GMAIL_USER, to: email, subject: 'Confirm your ECOBUD email change',
      text: `Your email change code is ${code}. It expires in 10 minutes. If you did not request this change, ignore this email.`,
    });
  } catch {
    await prisma.otpCode.deleteMany({ where: { email: key, code: hash } });
    throw new HttpError(503, 'Verification email could not be sent. Please try again later.');
  }
}
