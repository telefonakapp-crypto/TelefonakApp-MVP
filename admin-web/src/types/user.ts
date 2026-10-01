export type MarketplaceUserListItem = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  phone_number: string;
  email?: string | null;
  is_active: boolean;
  is_verified?: boolean;
  created_at: string;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  total_listings: number;
};

export type MarketplaceUserDetail = MarketplaceUserListItem & {
  gender?: string | null;
  city?: string | null;
  date_of_birth?: string | null;
  updated_at?: string;
  active_listings: number;
  sold_listings: number;
  pending_listings: number;
  declined_listings: number;
  favorites_count: number;
};

export type MarketplaceUserListing = {
  id: number;
  brand_name: string;
  model_name: string;
  price: number | string;
  status: string;
  created_at: string;
  thumbnail_image: string | null;
};

export type UsersPagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type UsersListResponse = {
  items: MarketplaceUserListItem[];
  pagination: UsersPagination;
};

export type UserDetailResponse = {
  user: MarketplaceUserDetail;
  listings: MarketplaceUserListing[];
};

export type UsersQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
};
