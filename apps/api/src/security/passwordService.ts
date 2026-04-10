import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const PasswordService = {
  hash: (value: string) => bcrypt.hash(value, SALT_ROUNDS),
  compare: (value: string, hashedValue: string) => bcrypt.compare(value, hashedValue),
};
