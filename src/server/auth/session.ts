/**
 * Session handling.
 *
 * A session is a random opaque token stored in an httpOnly cookie. Only its
 * SHA-256 hash is persisted, so a database leak does not hand over live
 * sessions. The cookie value is additionally signed as a JWT so a tampered
 * cookie is rejected before touching the database.
 */

import { createHash, randomBytes } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { env } from "../env";

export const SESSION_COOKIE_NAME = "jcj_session";

interface SessionPayload {
  token: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().AUTH_SECRET);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(): Date {
  const days = env().SESSION_MAX_AGE_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function signCookieValue(token: string): Promise<string> {
  return new SignJWT({ token } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(sessionExpiry())
    .sign(secretKey());
}

async function readCookieValue(value: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(value, secretKey());
    const token = (payload as unknown as SessionPayload).token;
    return typeof token === "string" ? token : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, await signCookieValue(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: sessionExpiry(),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/** The raw session token from the request cookie, if it is valid. */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return null;
  return readCookieValue(cookie.value);
}
