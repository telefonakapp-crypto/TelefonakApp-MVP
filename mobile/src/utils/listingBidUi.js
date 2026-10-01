import { isBidListing } from './listingOwnerCapabilities.js';

const BID_AMOUNT_RE = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;

export function bidAmountIssue(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return 'amountRequired';
  if (!BID_AMOUNT_RE.test(value) || value === '0' || /^0\.0+$/.test(value)) {
    return 'invalidAmount';
  }
  return null;
}

export function auctionHasBids(auction) {
  const highest = auction?.current_highest_bid;
  return highest != null && String(highest).trim() !== '';
}

function moneyText(value) {
  return String(value ?? '').trim();
}

/** Display-only: buyer is leading when their stored high equals the auction high. */
export function isViewerHighestBidder(auction) {
  if (!auction?.has_my_bids || !auctionHasBids(auction)) return false;
  const mine = moneyText(auction.my_highest_bid);
  const high = moneyText(auction.current_highest_bid);
  return Boolean(mine) && mine === high;
}

/** Display-only: buyer has bids and they are below the current high. */
export function isViewerOutbid(auction) {
  if (!auction?.has_my_bids || !auctionHasBids(auction)) return false;
  const mine = moneyText(auction.my_highest_bid);
  const high = moneyText(auction.current_highest_bid);
  return Boolean(mine && high && mine !== high);
}

export function canPlaceBidOnListing(listing) {
  if (!listing || listing.is_owner) return false;
  if (!isBidListing(listing)) return false;
  if (
    listing.status === 'bid_duration_ended' ||
    listing.status === 'sold' ||
    listing.status === 'deleted'
  ) {
    return false;
  }
  const auction = listing.auction;
  if (!auction || typeof auction !== 'object') return false;
  if (auction.auction_status !== 'live') return false;
  const minimum = auction.minimum_next_bid;
  if (minimum == null || String(minimum).trim() === '') return false;
  return true;
}

export function canManageLiveBid(listing) {
  if (!listing?.is_owner) return false;
  if (!isBidListing(listing)) return false;
  return listing.auction?.auction_status === 'live';
}

export function canExtendLiveBid(listing) {
  return canManageLiveBid(listing) && listing.auction?.extension_used !== true;
}

/**
 * List Again is owner-only and fail-closed on the backend capability.
 * Missing can_list_again is treated as false. Status fields are defensive only.
 */
export function canListAgain(listing, { isOwner } = {}) {
  const owner = isOwner === true || (isOwner !== false && listing?.is_owner === true);
  if (!owner) return false;
  if (!isBidListing(listing)) return false;
  if (listing.status !== 'bid_duration_ended') return false;
  const auction = listing.auction;
  if (!auction || typeof auction !== 'object') return false;
  if (auction.can_list_again !== true) return false;
  if (auction.auction_status != null && auction.auction_status !== 'completed') {
    return false;
  }
  if (auction.completion_source != null && auction.completion_source !== 'expired') {
    return false;
  }
  return true;
}

export function buildSoldEndBidBody(winningBidId) {
  return { action: 'sold', winning_bid_id: winningBidId };
}

export function buildCancelEndBidBody() {
  return { action: 'cancel' };
}

export function buildExtendBidBody(durationHours) {
  return { duration_hours: Number(durationHours) };
}

export function buildListAgainBody(durationHours) {
  return { duration_hours: Number(durationHours) };
}

export function fillTemplate(template, values = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) =>
    values[key] != null ? String(values[key]) : ''
  );
}

export function shouldFetchPublicBidHistory(listing) {
  if (!listing || listing.is_owner) return false;
  return isBidListing(listing);
}

/** Keep API order. Copy only public-safe amount + created_at. */
export function sanitizePublicBidHistory(payload) {
  const source = Array.isArray(payload?.bids) ? payload.bids : [];
  const bids = [];
  for (const row of source) {
    if (!row || typeof row !== 'object') continue;
    if (row.amount == null || String(row.amount).trim() === '') continue;
    bids.push({
      amount: String(row.amount),
      created_at: row.created_at ?? null,
    });
  }
  return {
    bids,
    has_more: payload?.has_more === true,
  };
}

export function formatBidTimeAgo(value, nowMs, t) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t('bids.justNow');
  if (minutes === 1) return t('bids.minuteAgo');
  if (minutes < 60) return fillTemplate(t('bids.minutesAgo'), { n: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return t('bids.hourAgo');
  if (hours < 24) return fillTemplate(t('bids.hoursAgo'), { n: String(hours) });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('bids.dayAgo');
  return fillTemplate(t('bids.daysAgo'), { n: String(days) });
}

export function applyExtendToListing(listing, payload) {
  if (!listing) return listing;
  const auction =
    listing.auction && typeof listing.auction === 'object' ? listing.auction : {};
  const nextAuction = payload?.auction && typeof payload.auction === 'object'
    ? payload.auction
    : {};
  const next = { ...auction };
  if (nextAuction.ends_at != null) next.ends_at = nextAuction.ends_at;
  if (nextAuction.extension_used != null) next.extension_used = nextAuction.extension_used;
  if (nextAuction.auction_status != null) next.auction_status = nextAuction.auction_status;
  return { ...listing, auction: next };
}

export function shouldShowMakeOffer(listing, isOwner) {
  if (!listing || isOwner) return false;
  if (isBidListing(listing)) return false;
  return !listing.has_my_offer && listing.status === 'approved';
}

export function shouldShowOfferCard(listing, isOwner) {
  if (!listing || isOwner) return false;
  if (isBidListing(listing)) return false;
  return Boolean(listing.has_my_offer);
}

/** Merge POST /listings/:id/bids 201 fields onto listing.auction. Does not invent clocks. */
export function applyPlaceBidToListing(listing, payload) {
  if (!listing) return listing;
  const auction =
    listing.auction && typeof listing.auction === 'object' ? listing.auction : {};
  const next = { ...auction, has_my_bids: true };
  if (payload?.highest_bid != null) next.current_highest_bid = payload.highest_bid;
  if (payload?.minimum_next_bid != null) next.minimum_next_bid = payload.minimum_next_bid;
  if (payload?.maximum_bid != null) next.maximum_bid = payload.maximum_bid;
  if (payload?.auction_status != null) next.auction_status = payload.auction_status;
  if (payload?.ends_at != null) next.ends_at = payload.ends_at;
  if (payload?.bid?.amount != null) {
    next.my_highest_bid = payload.bid.amount;
    const prevCount = Number(auction.my_bid_count);
    next.my_bid_count = Number.isFinite(prevCount) ? prevCount + 1 : 1;
  }
  return { ...listing, auction: next };
}
