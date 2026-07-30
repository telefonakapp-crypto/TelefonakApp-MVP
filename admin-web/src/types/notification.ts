export type AdminNotification = {
  id: number;
  admin_id: number;
  related_listing_id: number | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type AdminNotificationsListResponse = {
  items: AdminNotification[];
  pagination: {
    limit: number;
    offset: number;
    has_more: boolean;
  };
};

export type AdminNotificationsQueryParams = {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
};
