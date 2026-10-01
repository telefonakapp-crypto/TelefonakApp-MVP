import apiClient from './apiClient';
import type {
  AdminListingDetailResponse,
  BrandOption,
  ListingsListResponse,
  ListingsQueryParams,
} from '../types/listing';

export async function fetchListings(
  params: ListingsQueryParams = {}
): Promise<ListingsListResponse> {
  const { data } = await apiClient.get<ListingsListResponse>('/admin/listings', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search || undefined,
      status: params.status || undefined,
      brand: params.brand || undefined,
      seller: params.seller || undefined,
      seller_id: params.seller_id || undefined,
      sale_type: params.sale_type || undefined,
    },
  });
  return data;
}

export async function fetchListingDetail(
  id: number
): Promise<AdminListingDetailResponse> {
  const { data } = await apiClient.get<AdminListingDetailResponse>(
    `/admin/listings/${id}`
  );
  return data;
}

export async function fetchListingBrands(): Promise<BrandOption[]> {
  const { data } = await apiClient.get<{ brands: BrandOption[] }>(
    '/admin/listings/brands'
  );
  return data.brands;
}

export async function approveListing(id: number): Promise<void> {
  await apiClient.post(`/admin/listings/${id}/approve`);
}

export async function declineListing(id: number, reason: string): Promise<void> {
  await apiClient.post(`/admin/listings/${id}/decline`, { reason });
}

export async function deleteListing(id: number): Promise<void> {
  await apiClient.post(`/admin/listings/${id}/delete`);
}
