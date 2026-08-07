import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export const PIN_LENGTH = 6;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

export function validatePin(pin: string) {
  return /^\d{6}$/.test(pin);
}

/** Stores a salted scrypt representation; plaintext PINs never leave this function. */
export async function hashPin(pin: string) {
  if (!validatePin(pin)) throw new Error("O PIN deve ter 6 dígitos.");
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(pin, salt, KEY_LENGTH) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPin(pin: string, encoded: string) {
  if (!validatePin(pin)) return false;
  const [scheme, salt, expected] = encoded.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = await scrypt(pin, salt, KEY_LENGTH) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}

export function nextPinFailureState(currentAttempts: number, now = new Date()) {
  const pinFailedAttempts = currentAttempts + 1;
  return {
    pinFailedAttempts,
    pinLockedUntil: pinFailedAttempts >= MAX_PIN_ATTEMPTS
      ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000)
      : null,
  };
}
