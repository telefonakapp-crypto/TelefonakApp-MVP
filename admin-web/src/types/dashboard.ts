export type DashboardStats = {
  totalUsers: number;
  totalAdmins: number;
  activeListings: number;
  pendingListings: number;
  approvedListings: number;
  declinedListings: number;
  soldListings: number;
  hiddenListings: number;
  activeBanners: number;
};

export type DashboardRecentListing = {
  id: number;
  brand_name: string;
  model_name: string;
  price: number | string;
  status: string;
  created_at: string;
  seller_name: string;
  thumbnail_image: string | null;
};

export type SystemHealthStatus = 'online' | 'offline';

export type DashboardResponse = {
  stats: DashboardStats;
  recentListings: DashboardRecentListing[];
  systemHealth: {
    database: SystemHealthStatus;
    api: SystemHealthStatus;
  };
};
