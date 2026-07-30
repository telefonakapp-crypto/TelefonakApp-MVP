import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { uploadBannerImage } from '../../services/bannerService';
import type { Banner, BannerFormValues, BannerPayload } from '../../types/banner';

function toDatetimeLocalValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isValidHttpUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function bannerToFormValues(banner?: Banner | null): BannerFormValues {
  return {
    title: banner?.title || '',
    subtitle: banner?.subtitle || '',
    image_url: banner?.image_url || '',
    cta_text: banner?.cta_text || '',
    cta_link:
      banner?.cta_link ||
      (banner?.action_type === 'url' ? banner.action_value || '' : '') ||
      '',
    starts_at: toDatetimeLocalValue(banner?.starts_at),
    ends_at: toDatetimeLocalValue(banner?.ends_at),
    is_active: banner?.is_active ?? true,
  };
}

type BannerFormProps = {
  open: boolean;
  mode: 'create' | 'edit';
  banner?: Banner | null;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: BannerPayload) => void;
};

export function BannerForm({
  open,
  mode,
  banner,
  submitting = false,
  error,
  onClose,
  onSubmit,
}: BannerFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BannerFormValues>({
    defaultValues: bannerToFormValues(banner),
  });

  const imageUrl = watch('image_url');

  useEffect(() => {
    if (open) {
      reset(bannerToFormValues(banner));
      setUploadError(null);
    }
  }, [open, banner, reset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting && !uploading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, uploading, onClose]);

  if (!open) return null;

  const submit = handleSubmit((values) => {
    const startsAt = fromDatetimeLocalValue(values.starts_at);
    const endsAt = fromDatetimeLocalValue(values.ends_at);

    onSubmit({
      title: values.title.trim(),
      subtitle: values.subtitle.trim() || null,
      image_url: values.image_url.trim(),
      cta_text: values.cta_text.trim() || null,
      cta_link: values.cta_link.trim() || null,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: values.is_active,
    });
  });

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadBannerImage(file);
      setValue('image_url', url, { shouldValidate: true, shouldDirty: true });
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to upload image';
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close form"
        className="absolute inset-0 bg-slate-900/40"
        onClick={() => {
          if (!submitting && !uploading) onClose();
        }}
      />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-xl md:max-w-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === 'create' ? 'Create banner' : 'Edit banner'}
            </h2>
            <p className="text-sm text-slate-500">Home screen carousel creative</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || uploading}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form className="flex flex-1 flex-col overflow-hidden" onSubmit={submit} noValidate>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div>
              <label htmlFor="banner-title" className="mb-1.5 block text-sm font-medium text-slate-700">
                Title <span className="text-red-600">*</span>
              </label>
              <input
                id="banner-title"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                {...register('title', { required: 'Title is required' })}
              />
              {errors.title ? (
                <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="banner-subtitle" className="mb-1.5 block text-sm font-medium text-slate-700">
                Subtitle
              </label>
              <input
                id="banner-subtitle"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                {...register('subtitle')}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Image <span className="text-red-600">*</span>
              </label>
              <input
                type="hidden"
                {...register('image_url', { required: 'Image is required' })}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={uploading || submitting}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {uploading ? 'Uploading…' : imageUrl ? 'Replace image' : 'Upload image'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {errors.image_url ? (
                <p className="mt-1 text-xs text-red-600">{errors.image_url.message}</p>
              ) : null}
              {uploadError ? (
                <p className="mt-1 text-xs text-red-600">{uploadError}</p>
              ) : null}
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Banner preview"
                  className="mt-3 aspect-[16/7] w-full rounded-xl object-cover"
                />
              ) : (
                <div className="mt-3 flex aspect-[16/7] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
                  Preview will appear here
                </div>
              )}
            </div>

            <div>
              <label htmlFor="banner-cta-text" className="mb-1.5 block text-sm font-medium text-slate-700">
                CTA Text
              </label>
              <input
                id="banner-cta-text"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                {...register('cta_text')}
              />
            </div>

            <div>
              <label htmlFor="banner-cta-link" className="mb-1.5 block text-sm font-medium text-slate-700">
                CTA Link
              </label>
              <input
                id="banner-cta-link"
                type="url"
                placeholder="https://…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                {...register('cta_link', {
                  validate: (value) =>
                    isValidHttpUrl(value) || 'Enter a valid http(s) URL',
                })}
              />
              {errors.cta_link ? (
                <p className="mt-1 text-xs text-red-600">{errors.cta_link.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="banner-starts" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Start Date
                </label>
                <input
                  id="banner-starts"
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  {...register('starts_at')}
                />
              </div>
              <div>
                <label htmlFor="banner-ends" className="mb-1.5 block text-sm font-medium text-slate-700">
                  End Date
                </label>
                <input
                  id="banner-ends"
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  {...register('ends_at', {
                    validate: (value, formValues) => {
                      if (!value || !formValues.starts_at) return true;
                      return (
                        new Date(formValues.starts_at) <= new Date(value) ||
                        'End date must be after start date'
                      );
                    },
                  })}
                />
                {errors.ends_at ? (
                  <p className="mt-1 text-xs text-red-600">{errors.ends_at.message}</p>
                ) : null}
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                {...register('is_active')}
              />
              Active
            </label>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
          </div>

          <div className="flex gap-2 border-t border-slate-200 p-4">
            <button
              type="button"
              disabled={submitting || uploading}
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : mode === 'create' ? 'Create banner' : 'Save changes'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
