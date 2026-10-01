export type AdminAuctionStatus =
  | 'pending_start'
  | 'live'
  | 'ended'
  | 'cancelled'
  | 'completed'
  | string;

const AUCTION_STATUS_LABELS: Record<string, string> = {
  pending_start: 'Pending',
  live: 'Live',
  ended: 'Ended',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const COMPLETION_SOURCE_LABELS: Record<string, string> = {
  expired: 'Expired',
  sold: 'Sold',
  cancelled: 'Cancelled',
};

export function saleTypeLabel(saleType?: string | null) {
  return saleType === 'bid' ? 'Bid' : 'Normal';
}

export function auctionStatusLabel(status?: string | null) {
  if (!status) return '—';
  return AUCTION_STATUS_LABELS[status] || status;
}

export function completionSourceLabel(source?: string | null) {
  if (!source) return null;
  return COMPLETION_SOURCE_LABELS[source] || source;
}

export function formatAdminMoney(value?: number | string | null) {
  if (value == null || String(value).trim() === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return `${numeric.toLocaleString()} JOD`;
}

export function formatAdminDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}
