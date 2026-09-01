export type ReportsOverview = {
  users: {
    total: number;
    active: number;
    disabled: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  listings: {
    total: number;
    pending: number;
    /** Current re-review queue (status = resubmitted). */
    resubmitted: number;
    /** Current approved-edit queue (status = updated). */
    updated: number;
    approved: number;
    declined: number;
    sold: number;
    hidden: number;
    createdToday: number;
    createdThisWeek: number;
    createdThisMonth: number;
    logicalListings: number;
    revisionSnapshots: number;
    /** All-time revision rows (previous_listing_id set / revision_number > 1). */
    /** Historical resubmission events (not current status). */
    resubmissionsReceived: number;
    resubmissionsReceivedThisMonth: number;
    updatesReceived: number;
    updatesReceivedThisMonth: number;
    declinedThisMonth: number;
    approvedThisMonth: number;
    avgRevisionsPerListing: number;
  };
  offers: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  };
  banners: {
    total: number;
    active: number;
    scheduled: number;
    expired: number;
    disabled: number;
  };
};

export type DailyCountPoint = {
  date: string;
  count: number;
};

export type LabeledCount = {
  label: string;
  count: number;
};

export type LabeledValue = {
  label: string;
  value: number;
};

export type ReportsCharts = {
  days: number;
  userRegistrations: DailyCountPoint[];
  listingsCreated: DailyCountPoint[];
  listingsByBrand: LabeledCount[];
  listingsByCondition: LabeledCount[];
  listingStatusDistribution: LabeledCount[];
  averagePriceByBrand: LabeledValue[];
};

export type ReportExportType = 'users' | 'listings' | 'offers';

export type ReportRangeDays = 7 | 30 | 90;
