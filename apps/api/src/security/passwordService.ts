import bcrypt from 'bcryptjs';

// SECURITY: Each bcrypt check is slow on purpose, so trying millions of guesses against a stolen database would take a very long time.
const SALT_ROUNDS = 10;

export const PasswordService = {
  // SECURITY: Each password is stored as a one-way hash with its own random salt, so a leaked database doesn't reveal passwords and equal passwords get different hashes.
  hash: (value: string) => bcrypt.hash(value, SALT_ROUNDS),
  // SECURITY: Login hashes the entered password the same way and compares the results, so the stored hash never has to be reversed.
  compare: (value: string, hashedValue: string) => bcrypt.compare(value, hashedValue),
};
