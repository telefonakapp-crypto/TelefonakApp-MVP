const { getAllSettings } = require('./settings');

function formatJodAmount(value) {
  const n = Number(value);
  const fractionDigits = Number.isInteger(n) ? 0 : 2;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  });
}

function toMoneyNumber(value) {
  if (typeof value === 'boolean' || value == null) return null;
  if (typeof value === 'object') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function toCents(amount) {
  return Math.round(amount * 100);
}

async function getListingPriceLimits(client) {
  const { settings } = await getAllSettings(client);
  return {
    min: settings.min_listing_price,
    max: settings.max_listing_price,
  };
}

/**
 * Live Admin Settings bounds for listing price (min_listing_price / max_listing_price).
 * Reads the database on every call so setting changes apply without a restart.
 */
async function assertListingPriceWithinLimits(price, client) {
  const amount = toMoneyNumber(price);
  if (amount === null || amount <= 0) {
    const error = new Error('Price must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  const { min, max } = await getListingPriceLimits(client);
  const cents = toCents(amount);

  if (cents < toCents(min)) {
    const error = new Error(`Price must be at least ${formatJodAmount(min)} JOD.`);
    error.statusCode = 400;
    throw error;
  }

  if (cents > toCents(max)) {
    const error = new Error(`Price cannot exceed ${formatJodAmount(max)} JOD.`);
    error.statusCode = 400;
    throw error;
  }

  return amount;
}

module.exports = {
  formatJodAmount,
  toMoneyNumber,
  toCents,
  getListingPriceLimits,
  assertListingPriceWithinLimits,
};
