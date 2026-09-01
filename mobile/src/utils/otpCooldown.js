/**
 * OTP resend-cooldown helpers.
 *
 * Two independent timers exist on the backend:
 * 1) OTP validity (otp_ttl_seconds) — how long a code can be redeemed.
 * 2) Resend cooldown (resend_cooldown_seconds / limit=resend_cooldown) — when
 *    the next send is allowed.
 *
 * The hourly request-window limit (limit=request_window) is a third budget and
 * must NEVER drive the Resend button countdown.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Fallback only when the API omits resend_cooldown_seconds (should not happen). */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Fallback for request-window toasts when retry_after_seconds is missing. */
const OTP_REQUEST_WINDOW_FALLBACK_SECONDS = 60 * 60;

export const OTP_LIMIT = {
  RESEND_COOLDOWN: 'resend_cooldown',
  REQUEST_WINDOW: 'request_window',
};

/**
 * @param {unknown} error
 * @returns {'resend_cooldown'|'request_window'|null}
 */
export function getOtpLimitType(error) {
  const limit = error?.response?.data?.limit;
  if (limit === OTP_LIMIT.RESEND_COOLDOWN || limit === OTP_LIMIT.REQUEST_WINDOW) {
    return limit;
  }
  return null;
}

/**
 * @param {unknown} error
 * @returns {number|null}
 */
export function getOtpRetryAfterSeconds(error) {
  const raw =
    error?.response?.data?.retry_after_seconds ??
    error?.response?.headers?.['retry-after'] ??
    error?.response?.headers?.['Retry-After'];

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.max(0, Math.ceil(n));
}

/** True only for the short resend gap — not the hourly request window. */
export function isOtpResendCooldownError(error) {
  if (error?.response?.status !== 429) return false;
  const limit = getOtpLimitType(error);
  if (limit === OTP_LIMIT.REQUEST_WINDOW) return false;
  if (limit === OTP_LIMIT.RESEND_COOLDOWN) return true;
  // Legacy responses without `limit`: treat short waits as cooldown only.
  const retryAfter = getOtpRetryAfterSeconds(error);
  return retryAfter != null && retryAfter <= OTP_RESEND_COOLDOWN_SECONDS;
}

export function isOtpRequestWindowError(error) {
  if (error?.response?.status !== 429) return false;
  if (getOtpLimitType(error) === OTP_LIMIT.REQUEST_WINDOW) return true;
  // Legacy: long retry_after without limit field → hourly window.
  const retryAfter = getOtpRetryAfterSeconds(error);
  return retryAfter != null && retryAfter > OTP_RESEND_COOLDOWN_SECONDS;
}

/** @deprecated use isOtpResendCooldownError */
export function isOtpCooldownError(error) {
  return isOtpResendCooldownError(error);
}

/**
 * Read resend cooldown from a successful OTP-issue response.
 * @param {unknown} data
 * @returns {number}
 */
export function getResendCooldownFromSuccess(data) {
  const n = Number(data?.resend_cooldown_seconds);
  if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  return OTP_RESEND_COOLDOWN_SECONDS;
}

/**
 * Friendly copy for the short resend cooldown.
 * @param {number} seconds
 */
export function formatOtpCooldownToast(seconds) {
  const s = Math.max(1, Math.ceil(Number(seconds) || 1));
  return `Please wait ${s} seconds before requesting another verification code.`;
}

/**
 * Friendly copy for the hourly request-window budget (not the Resend countdown).
 * @param {number} seconds
 */
export function formatOtpRequestWindowToast(seconds) {
  const minutes = Math.max(1, Math.ceil((Number(seconds) || 60) / 60));
  return `Too many verification codes requested. Please try again in ${minutes} minutes.`;
}

/**
 * Handle a failed OTP request for UI purposes.
 * @returns {{ kind: 'resend_cooldown', seconds: number }
 *          |{ kind: 'request_window', seconds: number }
 *          |{ kind: 'other' }}
 */
export function classifyOtpRequestFailure(error) {
  const retryAfter = getOtpRetryAfterSeconds(error);

  if (isOtpRequestWindowError(error)) {
    return {
      kind: 'request_window',
      seconds: retryAfter ?? OTP_REQUEST_WINDOW_FALLBACK_SECONDS,
    };
  }

  if (isOtpResendCooldownError(error) || (error?.response?.status === 429 && retryAfter != null)) {
    return {
      kind: 'resend_cooldown',
      seconds: retryAfter ?? OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  return { kind: 'other' };
}

function normalizeSeconds(value) {
  return Math.max(0, Math.ceil(Number(value) || 0));
}

/**
 * Deadline-based countdown for the Resend button only.
 * @param {number} [initialSeconds]
 */
export function useOtpCooldown(initialSeconds = 0) {
  const seeded = normalizeSeconds(initialSeconds);
  const endsAtRef = useRef(seeded > 0 ? Date.now() + seeded * 1000 : 0);
  const [secondsLeft, setSecondsLeft] = useState(seeded);
  const inFlightRef = useRef(false);
  const seededRef = useRef(seeded);

  useEffect(() => {
    const next = normalizeSeconds(initialSeconds);
    if (next === seededRef.current) return;
    seededRef.current = next;
    if (next > 0) {
      endsAtRef.current = Date.now() + next * 1000;
      setSecondsLeft(next);
    }
  }, [initialSeconds]);

  useEffect(() => {
    const tick = () => {
      if (!endsAtRef.current) {
        setSecondsLeft((prev) => (prev === 0 ? prev : 0));
        return;
      }
      const remaining = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      if (remaining === 0) {
        endsAtRef.current = 0;
      }
      setSecondsLeft((prev) => (prev === remaining ? prev : remaining));
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, []);

  const startCooldown = useCallback((seconds = OTP_RESEND_COOLDOWN_SECONDS) => {
    const s = normalizeSeconds(seconds);
    endsAtRef.current = s > 0 ? Date.now() + s * 1000 : 0;
    setSecondsLeft(s);
  }, []);

  const clearCooldown = useCallback(() => {
    endsAtRef.current = 0;
    setSecondsLeft(0);
  }, []);

  const beginRequest = useCallback(() => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    return true;
  }, []);

  const endRequest = useCallback(() => {
    inFlightRef.current = false;
  }, []);

  return {
    secondsLeft,
    isCoolingDown: secondsLeft > 0,
    startCooldown,
    clearCooldown,
    beginRequest,
    endRequest,
    isRequestInFlight: () => inFlightRef.current,
  };
}
