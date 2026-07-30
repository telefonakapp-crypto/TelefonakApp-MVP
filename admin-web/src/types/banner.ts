export type BannerLifecycleStatus =
  | 'active'
  | 'scheduled'
  | 'expired'
  | 'disabled';

export type BannerActionType = 'none' | 'url' | 'screen' | 'listing';

export type Banner = {
  id: number;
  title: string;
  subtitle?: string | null;
  image_url: string;
  cta_text?: string | null;
  cta_link?: string | null;
  action_type: BannerActionType | string;
  action_value?: string | null;
  display_order: number;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
  updated_at?: string;
  status: BannerLifecycleStatus;
};

export type BannerFormValues = {
  title: string;
  subtitle: string;
  image_url: string;
  cta_text: string;
  cta_link: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export type BannerPayload = {
  title: string;
  subtitle?: string | null;
  image_url: string;
  cta_text?: string | null;
  cta_link?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
};

export type BannersListResponse = {
  banners: Banner[];
};

export type BannersQueryParams = {
  search?: string;
  status?: string;
};
