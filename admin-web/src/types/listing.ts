export type ListingStatus =
  | 'pending'
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

export type AdminListingDetail = {
  id: number;
  brand_id: number;
  brand_name: string;
  model_name: string;
  capacity_gb: number;
  color_name: string;
  color_hex?: string | null;
  condition_name: string;
  battery_percentage: number;
  price: number | string;
  description: string | null;
  description_en?: string | null;
  description_ar?: string | null;
  location: string | null;
  status: ListingStatus | string;
  decline_reason?: string | null;
  created_at: string;
  updated_at?: string;
  sim_configuration_name?: string | null;
  release_year?: number | null;
  chipset?: string | null;
  screen_size?: string | null;
  seller: AdminListingSeller;
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
