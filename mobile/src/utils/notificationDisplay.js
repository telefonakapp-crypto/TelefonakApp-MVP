/**
 * Notification Center display helpers.
 *
 * The API stores English title/message snapshots. The UI localizes from
 * `type` (and a few stored-title disambiguators) so the same row can render
 * in English or Arabic without duplicating English copy into the client.
 */

function extractQuotedName(message) {
  if (!message || typeof message !== 'string') return '';
  const match = /"([^"]+)"/.exec(message);
  return match ? match[1] : '';
}

function extractOfferPrice(message) {
  if (!message || typeof message !== 'string') return '';
  const match = /offer of (\S+) JOD/i.exec(message);
  return match ? match[1] : '';
}

function extractReason(message) {
  if (!message || typeof message !== 'string') return '';
  const match = /\sReason:\s([\s\S]*)$/.exec(message);
  return match ? match[1].trim() : '';
}

function fill(template, vars) {
  let out = String(template || '');
  Object.entries(vars).forEach(([key, value]) => {
    out = out.split(`{${key}}`).join(value == null ? '' : String(value));
  });
  return out.replace(/\s+/g, ' ').trim();
}

function isDeclinedListingCopy(item) {
  const type = String(item?.type || '');
  const title = String(item?.title || '');
  const message = String(item?.message || '');
  return (
    type === 'listing_declined' ||
    title === 'Listing Declined' ||
    message.includes('no longer meets our listing guidelines')
  );
}

function listingToken(name, t) {
  return name ? `"${name}"` : t('notifications.listingWord');
}

/**
 * Localized title + message for a notification row.
 * English keeps the stored API strings. Arabic maps `type` through i18n.
 */
export function localizeNotification(item, t, language) {
  const storedTitle = item?.title || '';
  const storedMessage = item?.message || '';
  if (language !== 'ar') {
    return { title: storedTitle, message: storedMessage };
  }

  const name = extractQuotedName(storedMessage);
  const listing = listingToken(name, t);
  const price = extractOfferPrice(storedMessage);
  const reason = extractReason(storedMessage);
  const reasonSuffix = reason
    ? t('notifications.reasonSuffix').replace('{reason}', reason)
    : '';

  const type = String(item?.type || '');

  const byType = {
    listing_approved: {
      title: t('notifications.types.listingApproved.title'),
      message: fill(t('notifications.types.listingApproved.message'), { listing }),
    },
    listing_live: {
      title: t('notifications.types.listingLive.title'),
      message: fill(t('notifications.types.listingLive.message'), { listing }),
    },
    listing_submitted: {
      title: t('notifications.types.listingSubmitted.title'),
      message: fill(t('notifications.types.listingSubmitted.message'), { listing }),
    },
    listing_resubmitted: {
      title: t('notifications.types.listingResubmitted.title'),
      message: t('notifications.types.listingResubmitted.message'),
    },
    listing_updated: {
      title: t('notifications.types.listingUpdated.title'),
      message: t('notifications.types.listingUpdated.message'),
    },
    listing_sold: {
      title: t('notifications.types.listingSold.title'),
      message: fill(t('notifications.types.listingSold.message'), { listing }),
    },
    listing_hidden: {
      title: t('notifications.types.listingHidden.title'),
      message: fill(t('notifications.types.listingHidden.message'), { listing }),
    },
    listing_active: {
      title: t('notifications.types.listingActive.title'),
      message: fill(t('notifications.types.listingActive.message'), { listing }),
    },
    offer_received: {
      title: t('notifications.types.offerReceived.title'),
      message: fill(t('notifications.types.offerReceived.message'), {
        listing,
        price,
      }),
    },
    offer_accepted: {
      title: t('notifications.types.offerAccepted.title'),
      message: fill(t('notifications.types.offerAccepted.message'), {
        listing,
        price,
      }),
    },
    offer_rejected: {
      title: t('notifications.types.offerRejected.title'),
      message: fill(t('notifications.types.offerRejected.message'), {
        listing,
        price,
      }),
    },
  };

  if (type === 'listing_rejected' || type === 'listing_declined') {
    if (isDeclinedListingCopy(item)) {
      return {
        title: t('notifications.types.listingDeclined.title'),
        message:
          t('notifications.types.listingDeclined.message') + reasonSuffix,
      };
    }
    return {
      title: t('notifications.types.listingRejected.title'),
      message:
        fill(t('notifications.types.listingRejected.message'), { listing }) +
        reasonSuffix,
    };
  }

  const mapped = byType[type];
  if (mapped) return mapped;

  return { title: storedTitle, message: storedMessage };
}

/**
 * Display a notification timestamp.
 * Arabic: 24-hour `HH:mm` with Latin digits, no AM/PM or ص/م.
 * English: existing 12-hour locale time.
 * Uses the Date's local wall-clock components — no timezone conversion.
 */
export function formatNotificationTime(value, language) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  if (language === 'ar') {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
