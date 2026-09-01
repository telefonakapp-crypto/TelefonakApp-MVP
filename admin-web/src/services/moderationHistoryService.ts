import apiClient from './apiClient';

export type ModerationHistoryType = 'resubmitted' | 'updated';

export type ModerationHistoryItem = {
  id: number;
  event_type: ModerationHistoryType | string;
  occurred_at: string;
  previous_status: string | null;
  new_status: string;
  event_price: number | string | null;
  current_status: string;
  current_price: number | string | null;
  previous_price: number | string | null;
  listing_id: number;
  previous_listing_id: number | null;
  root_listing_id: number;
  brand_name: string;
  model_name: string;
  seller_name: string;
  thumbnail_image: string | null;
};

export type ModerationHistoryResponse = {
  month: string;
  type: string;
  items: ModerationHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export async function fetchModerationHistory(params: {
  type: ModerationHistoryType;
  month?: string;
  page?: number;
  limit?: number;
}): Promise<ModerationHistoryResponse> {
  const { data } = await apiClient.get<ModerationHistoryResponse>(
    '/admin/moderation-history',
    {
      params: {
        type: params.type,
        month: params.month,
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      },
    }
  );
  return data;
}
