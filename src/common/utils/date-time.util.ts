import {
  addDays as fnsAddDays,
  addMinutes as fnsAddMinutes,
  subDays,
  isAfter,
} from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MYANMAR_TZ = 'Asia/Yangon'; // UTC+6:30, no DST

export const OTP_TTL_MINUTES = 10;
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const LOG_RETENTION_DAYS = 90;
export const SMTP_CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Current time ─────────────────────────────────────────────────────────────

/** Current time as a UTC Date. Use this everywhere instead of `new Date()`. */
export function nowUtc(): Date {
  return new Date();
}

/** Current time as a UTC ISO 8601 string (e.g. for API response timestamps). */
export function nowIso(): string {
  return new Date().toISOString();
}

// ─── Future/past date helpers ─────────────────────────────────────────────────

/**
 * Returns a UTC Date N minutes from now (or from a given base date).
 * Use for OTP / 2FA expiry: `addMinutes(OTP_TTL_MINUTES)`.
 */
export function addMinutes(minutes: number, from: Date = nowUtc()): Date {
  return fnsAddMinutes(from, minutes);
}

/**
 * Returns a UTC Date N days from now (or from a given base date).
 * Use for refresh-token expiry: `addDays(REFRESH_TOKEN_TTL_DAYS)`.
 */
export function addDays(days: number, from: Date = nowUtc()): Date {
  return fnsAddDays(from, days);
}

/**
 * Returns a UTC Date N days in the past from now (or from a given base date).
 * Use for log-retention cutoff: `subtractDays(LOG_RETENTION_DAYS)`.
 */
export function subtractDays(days: number, from: Date = nowUtc()): Date {
  return subDays(from, days);
}

// ─── Expiry checks ────────────────────────────────────────────────────────────

/** Returns true if the given date is in the past. Null is treated as already expired. */
export function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return isAfter(new Date(), expiresAt);
}

// ─── Date range parsing ───────────────────────────────────────────────────────

/**
 * Parses a date string for use as the START of a filter range.
 *
 * - If the string contains timezone info (ISO 8601 with offset or Z), it is
 *   parsed as-is and converted to UTC.
 * - If it is a bare date ("2025-01-15"), it is interpreted as midnight at the
 *   START of that day in Myanmar local time, then converted to UTC.
 *
 * Use with TypeORM: `Between(parseRangeStart(dto.startDate), parseRangeEnd(dto.endDate))`
 */
export function parseRangeStart(dateStr: string): Date {
  if (hasTimezoneInfo(dateStr)) {
    return new Date(dateStr);
  }
  return fromZonedTime(`${dateStr}T00:00:00`, MYANMAR_TZ);
}

/**
 * Parses a date string for use as the END of a filter range.
 *
 * - If the string contains timezone info, it is parsed as-is and converted to UTC.
 * - If it is a bare date ("2025-01-15"), it is interpreted as 23:59:59.999 at the
 *   END of that day in Myanmar local time, then converted to UTC.
 */
export function parseRangeEnd(dateStr: string): Date {
  if (hasTimezoneInfo(dateStr)) {
    return new Date(dateStr);
  }
  return fromZonedTime(`${dateStr}T23:59:59.999`, MYANMAR_TZ);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function hasTimezoneInfo(dateStr: string): boolean {
  return (
    dateStr.includes('T') ||
    dateStr.endsWith('Z') ||
    /[+-]\d{2}:\d{2}$/.test(dateStr)
  );
}
