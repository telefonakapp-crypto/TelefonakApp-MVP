/**
 * Presentation helpers for the seller Received Bids screens.
 * Renders API order. Does not merge bids or invent winners.
 */
import { fillTemplate } from './listingBidUi.js';

export function bidderInitial(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  const first = Array.from(trimmed)[0];
  return /[A-Za-z]/.test(first) ? first.toUpperCase() : first;
}

/** The single bid that matches the highest amount. Ties are not marked. */
export function highestReceivedBidId(bids, currentHighestBid) {
  if (!Array.isArray(bids)) return null;
  if (currentHighestBid == null || String(currentHighestBid).trim() === '') return null;
  const target = String(currentHighestBid).trim();
  const matches = bids.filter((bid) => String(bid?.amount ?? '').trim() === target && bid?.id != null);
  return matches.length === 1 ? matches[0].id : null;
}

/**
 * Header for the seller's specific-listing bid list.
 * Countdown is only for a live auction that still has an end time.
 */
export function receivedAuctionHeader(auction) {
  const status = auction?.auction_status;
  if (status === 'live' && auction?.ends_at) {
    return {
      mode: 'live',
      showCountdown: true,
      labelKey: 'sellerBid.liveAuction',
      valueKey: 'bids.auctionEnded',
    };
  }
  if (status === 'cancelled') {
    return {
      mode: 'cancelled',
      showCountdown: false,
      labelKey: 'bids.cancelled',
      valueKey: 'sellerBid.bidCancelled',
    };
  }
  return {
    mode: 'completed',
    showCountdown: false,
    labelKey: 'bids.completed',
    valueKey: 'bids.auctionEnded',
  };
}

export function receivedBidRecords(bids) {
  return Array.isArray(bids) ? bids.slice() : [];
}

function clockLabel(date, language) {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const isPm = hours >= 12;
  hours = hours % 12 || 12;
  const suffix = language === 'ar' ? (isPm ? 'م' : 'ص') : isPm ? 'PM' : 'AM';
  return `${hours}:${minutes} ${suffix}`;
}

export function formatReceivedBidTimestamp(createdAt, t, nowMs = Date.now(), language = 'en') {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  const time = clockLabel(date, language);
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday.getTime() - 86400000;
  if (date.getTime() >= startOfToday.getTime()) {
    return fillTemplate(t('bids.bidTimeToday'), { time });
  }
  if (date.getTime() >= startOfYesterday) {
    return fillTemplate(t('bids.bidTimeYesterday'), { time });
  }
  const day = date.toLocaleDateString(language === 'ar' ? 'ar' : 'en', {
    day: 'numeric',
    month: 'short',
  });
  return fillTemplate(t('bids.bidTimeOn'), { day, time });
}
