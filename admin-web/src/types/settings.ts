export type MarketplaceSettings = {
  marketplace_name: string;
  marketplace_description: string;
  contact_email: string;
  contact_phone: string;
  auto_approve_listings: boolean;
  max_images_per_listing: number;
  max_listing_price: number;
  min_listing_price: number;
  allow_offers: boolean;
  max_active_banners: number;
  maintenance_mode: boolean;
};

export type SettingsMeta = Record<
  string,
  {
    updated_at?: string;
    updated_by?: number | null;
  }
>;

export type SettingsResponse = {
  settings: MarketplaceSettings;
  meta: SettingsMeta;
  message?: string;
};
