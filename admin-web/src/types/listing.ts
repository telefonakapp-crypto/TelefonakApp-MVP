export type ListingStatus =
  | 'pending'
  | 'resubmitted'
  | 'updated'
  | 'approved'
  | 'declined'
  | 'sold'
  | 'hidden'
  | 'deleted';

export type AdminListingListItem = {
  id: number;
  brand_id: number;
  brand_name: string;
  model_name: string;
  price: number | string;
  status: ListingStatus | string;
  created_at: string;
  updated_at?: string;
  capacity_gb?: number;
  color_name?: string;
  condition_name?: string;
  battery_percentage?: number;
  location?: string | null;
  decline_reason?: string | null;
  approved_or_rejected_at?: string | null;
  moderated_by_admin_id?: number | null;
  moderated_by?: string | null;
  resubmitted_at?: string | null;
  previous_listing_id?: number | null;
  revision_number?: number;
  root_listing_id?: number;
  seller_id: number;
  seller_name: string;
  seller_phone?: string;
  thumbnail_image: string | null;
};

export type AdminListingSeller = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number: string;
};

export type AdminListingRevisionSummary = {
  id: number;
  revision_number: number;
  status: ListingStatus | string;
  price?: number | string | null;
  created_at: string;
  resubmitted_at?: string | null;
  is_current?: boolean;
  is_historical_snapshot?: boolean;
  decline_reason?: string | null;
  approved_or_rejected_at?: string | null;
  moderated_by_admin_id?: number | null;
  moderated_by?: string | null;
};

export type AdminListingDetail = {
  id: number;
  brand_id: number;
  brand_name: string;
  model_name: string;
  capacity_gb?: number | null;
  color_name?: string | null;
  color_display_name?: string | null;
  color_hex?: string | null;
  category_slug?: string | null;
  case_size_label?: string | null;
  watch_connectivity_name?: string | null;
  condition_name: string;
  battery_percentage?: number | null;
  price: number | string;
  description: string | null;
  description_en?: string | null;
  description_ar?: string | null;
  location: string | null;
  status: ListingStatus | string;
  decline_reason?: string | null;
  created_at: string;
  updated_at?: string;
  approved_or_rejected_at?: string | null;
  moderated_by_admin_id?: number | null;
  moderated_by?: string | null;
  resubmitted_at?: string | null;
  previous_listing_id?: number | null;
  revision_number?: number;
  root_listing_id?: number;
  sim_configuration_name?: string | null;
  release_year?: number | null;
  chipset?: string | null;
  screen_size?: string | null;
  seller: AdminListingSeller;
  previous_listing?: AdminListingRevisionSummary | null;
  revision_history?: AdminListingRevisionSummary[];
};

export type AdminListingImage = {
  id: number;
  listing_id: number;
  image_url: string;
  display_order: number;
  created_at?: string;
};

export type AdminListingDetailResponse = {
  listing: AdminListingDetail;
  images: AdminListingImage[];
};

export type ListingsPagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type ListingsListResponse = {
  items: AdminListingListItem[];
  pagination: ListingsPagination;
};

export type ListingsQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  brand?: string;
  seller?: string;
};

export type BrandOption = {
  id: number;
  name: string;
};
