/**
 * Password hashing.
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(plainText: string): Promise<string> {
  if (plainText.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(
  plainText: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
