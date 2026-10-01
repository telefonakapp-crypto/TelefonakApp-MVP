import type { AdminNotification } from '../../types/notification';

export type NotificationCategory = 'all' | 'pending' | 'system' | 'seller';

export type NotificationStatusKind =
  | 'pending'
  | 'moderation'
  | 'approved'
  | 'rejected'
  | 'neutral';

export type ParsedNotificationMessage = {
  summary: string;
  seller: string | null;
  device: string | null;
  price: string | null;
  submitted: string | null;
};

const PENDING_TYPES = new Set([
  'new_listing',
  'listing_resubmitted',
  'listing_updated',
]);

const SELLER_UPDATE_TYPES = new Set([
  'offer_received',
  'offer_accepted',
  'offer_rejected',
  'listing_sold',
  'listing_hidden',
  'listing_active',
]);

export function parseAdminNotificationMessage(message: string): ParsedNotificationMessage {
  const lines = String(message || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedNotificationMessage = {
    summary: lines[0] || message || '',
    seller: null,
    device: null,
    price: null,
    submitted: null,
  };

  for (const line of lines) {
    const seller = line.match(/^Seller:\s*(.+)$/i);
    if (seller) {
      parsed.seller = seller[1].trim();
      continue;
    }
    const device = line.match(/^Device:\s*(.+)$/i);
    if (device) {
      parsed.device = device[1].trim();
      continue;
    }
    const price = line.match(/^Price:\s*(.+)$/i);
    if (price) {
      parsed.price = price[1].trim();
      continue;
    }
    const submitted = line.match(/^Submitted:\s*(.+)$/i);
    if (submitted) {
      parsed.submitted = submitted[1].trim();
      continue;
    }
  }

  return parsed;
}

export function notificationStatus(item: AdminNotification): {
  label: string;
  kind: NotificationStatusKind;
} {
  switch (item.type) {
    case 'new_listing':
      return { label: 'Pending Review', kind: 'pending' };
    case 'listing_resubmitted':
    case 'listing_updated':
    case 'listing_submitted':
      return { label: 'In Moderation', kind: 'moderation' };
    case 'listing_approved':
    case 'listing_live':
      return { label: 'Approved', kind: 'approved' };
    case 'listing_rejected':
    case 'listing_declined':
      return { label: 'Rejected', kind: 'rejected' };
    case 'bid_one_hour_remaining':
      return { label: 'Auction ending soon', kind: 'pending' };
    case 'system':
      return { label: 'System', kind: 'neutral' };
    default:
      return { label: item.type.replace(/_/g, ' '), kind: 'neutral' };
  }
}

export function isPendingModeration(item: AdminNotification) {
  return PENDING_TYPES.has(item.type);
}

export function matchesCategory(item: AdminNotification, category: NotificationCategory) {
  if (category === 'all') return true;
  if (category === 'pending') return isPendingModeration(item);
  if (category === 'system') return item.type === 'system';
  return SELLER_UPDATE_TYPES.has(item.type);
}

export function isWatchDevice(device: string | null) {
  if (!device) return false;
  return /watch/i.test(device);
}

export function formatNotificationDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function notificationSearchText(item: AdminNotification, parsed: ParsedNotificationMessage) {
  return [
    item.title,
    item.message,
    item.type,
    item.related_listing_id != null ? String(item.related_listing_id) : '',
    parsed.seller,
    parsed.device,
    parsed.price,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
