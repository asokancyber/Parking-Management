// Generate a temp password that's easy to read out loud over the phone if
// WhatsApp delivery fails. Pattern: PARK-AAAA1BB
//   - PARK prefix branding
//   - 4 uppercase letters (no ambiguous I/L/O)
//   - 1 digit (no 0/1)
//   - 2 uppercase letters
// 24^4 * 7 * 24^2 ≈ 1.3 billion combos. Plenty for a single-use temp.
import { randomBytes } from 'crypto';

const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';

function pick(set: string, bytes: Buffer, offset: number): string {
  return set[bytes[offset] % set.length];
}

export function generateTempPassword(): string {
  const b = randomBytes(8);
  let s = 'PARK-';
  for (let i = 0; i < 4; i++) s += pick(LETTERS, b, i);
  s += pick(DIGITS, b, 4);
  for (let i = 0; i < 2; i++) s += pick(LETTERS, b, 5 + i);
  return s;
}

// Password policy:
//   - >= 8 characters
//   - at least one uppercase, one lowercase, one digit, one special
// Returns null on success, error string on failure.
export function validatePassword(p: string): string | null {
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(p)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(p)) return 'Password must contain a lowercase letter';
  if (!/\d/.test(p)) return 'Password must contain a digit';
  if (!/[^A-Za-z0-9]/.test(p)) return 'Password must contain a special character';
  return null;
}
