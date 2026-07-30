import apiClient from './apiClient';
import type {
  Banner,
  BannerPayload,
  BannersListResponse,
  BannersQueryParams,
} from '../types/banner';

export async function fetchBanners(
  params: BannersQueryParams = {}
): Promise<Banner[]> {
  const { data } = await apiClient.get<BannersListResponse>('/admin/banners', {
    params: {
      search: params.search || undefined,
      status: params.status || undefined,
    },
  });
  return data.banners;
}

export async function createBanner(payload: BannerPayload): Promise<Banner> {
  const { data } = await apiClient.post<{ banner: Banner }>(
    '/admin/banners',
    payload
  );
  return data.banner;
}

export async function updateBanner(
  id: number,
  payload: BannerPayload
): Promise<Banner> {
  const { data } = await apiClient.put<{ banner: Banner }>(
    `/admin/banners/${id}`,
    payload
  );
  return data.banner;
}

export async function deleteBanner(id: number): Promise<void> {
  await apiClient.delete(`/admin/banners/${id}`);
}

export async function uploadBannerImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const { data } = await apiClient.post<{ image_url: string }>(
    '/admin/upload/image',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return data.image_url;
}
