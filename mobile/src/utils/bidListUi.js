/**
 * Presentation helpers for My Bids / Received Bids list rows.
 * Does not invent auction clocks or winners.
 */

export const BIDS_PAGE_SIZE = 50;

export function parseBidsPage(data) {
  const listings = Array.isArray(data?.listings) ? data.listings : [];
  const limit = Number.isFinite(Number(data?.limit)) ? Number(data.limit) : BIDS_PAGE_SIZE;
  const offset = Number.isFinite(Number(data?.offset)) ? Number(data.offset) : 0;
  return {
    listings,
    limit,
    offset,
    hasMore: data?.has_more === true,
  };
}

export function isLiveBidRow(listing) {
  return listing?.auction?.auction_status === 'live';
}

export function isCurrentlyHighest(auction) {
  if (!auction) return false;
  if (auction.auction_status !== 'live') return false;
  const mine = auction.my_highest_bid;
  const current = auction.current_highest_bid;
  if (mine == null || current == null) return false;
  return String(mine).trim() === String(current).trim();
}

export function isWinningBid(auction) {
  return auction?.is_winner === true;
}

export function bidRowStatusKey(listing) {
  const status = listing?.status;
  if (status === 'hidden') return 'hidden';
  if (status === 'sold') return 'sold';

  const auction = listing?.auction;
  const source = auction?.completion_source;
  if (source === 'sold') return 'sold';
  if (source === 'cancelled') return 'cancelled';
  if (source === 'expired') return 'bidDurationEnded';
  if (status === 'bid_duration_ended') return 'bidDurationEnded';

  const auctionStatus = auction?.auction_status;
  if (auctionStatus === 'live') return 'live';
  if (auctionStatus === 'pending_start') return 'pending';
  if (auctionStatus === 'cancelled') return 'cancelled';
  if (auctionStatus === 'completed') return 'completed';
  return status || 'completed';
}

export function buildBidsQuery(offset = 0) {
  return {
    params: {
      limit: BIDS_PAGE_SIZE,
      offset: Math.max(0, Number(offset) || 0),
    },
  };
}
