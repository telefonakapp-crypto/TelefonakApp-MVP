/**
 * Presentation-only remaining time from a server auction.ends_at.
 * Never invents clocks. Pass `nowMs` from tests for deterministic results.
 */

export function parseAuctionEndsAtMs(endsAt) {
  if (endsAt == null || endsAt === '') return null;
  const ms = Date.parse(endsAt);
  return Number.isFinite(ms) ? ms : null;
}

export function remainingMs(endsAt, nowMs = Date.now()) {
  const endMs = parseAuctionEndsAtMs(endsAt);
  if (endMs == null || !Number.isFinite(nowMs)) return null;
  return Math.max(0, endMs - nowMs);
}

export function formatCountdownParts(ms) {
  if (ms == null || !Number.isFinite(ms)) {
    return {
      valid: false,
      expired: false,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    valid: true,
    expired: totalSeconds === 0,
    days,
    hours,
    minutes,
    seconds,
  };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

/** Compact remaining label. Never negative. */
export function formatCountdownLabel(parts) {
  if (!parts?.valid) return '';
  const { days, hours, minutes, seconds } = parts;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${pad2(minutes)}m ${pad2(seconds)}s`;
  return `${minutes}m ${pad2(seconds)}s`;
}

export function formatCountdownClock(parts) {
  if (!parts?.valid) return '';
  if (parts.days > 0) return formatCountdownLabel(parts);
  return `${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
}

export function countdownFromEndsAt(endsAt, nowMs = Date.now()) {
  const ms = remainingMs(endsAt, nowMs);
  const parts = formatCountdownParts(ms);
  return {
    remainingMs: ms,
    ...parts,
    label: formatCountdownLabel(parts),
    clockLabel: formatCountdownClock(parts),
  };
}
