import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from 'react-router-dom';
import { fetchSettings, updateSettings } from '../../services/settingsService';
import { useAuth } from '../../hooks/useAuth';
import type { MarketplaceSettings } from '../../types/settings';

function settingsEqual(a: MarketplaceSettings, b: MarketplaceSettings) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function SettingsPage() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<MarketplaceSettings | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (settingsQuery.data?.settings) {
      setDraft(settingsQuery.data.settings);
      setSaveError(null);
      setSaveSuccess(null);
    }
  }, [settingsQuery.data]);

  const isDirty = useMemo(() => {
    if (!draft || !settingsQuery.data?.settings) return false;
    return !settingsEqual(draft, settingsQuery.data.settings);
  }, [draft, settingsQuery.data]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const leave = window.confirm(
      'You have unsaved settings changes. Leave this page and discard them?'
    );
    if (leave) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  const saveMutation = useMutation({
    mutationFn: () => updateSettings(draft as MarketplaceSettings),
    onSuccess: async (data) => {
      setSaveError(null);
      setSaveSuccess(data.message || 'Settings saved');
      setDraft(data.settings);
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err: unknown) => {
      setSaveSuccess(null);
      setSaveError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Failed to save settings'
      );
    },
  });

  const updateField = <K extends keyof MarketplaceSettings>(
    key: K,
    value: MarketplaceSettings[K]
  ) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaveSuccess(null);
  };

  if (settingsQuery.isLoading || !draft) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
          <p className="mt-1 text-sm text-slate-500">Marketplace configuration</p>
        </div>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Unable to load settings</h3>
          <button
            type="button"
            onClick={() => settingsQuery.refetch()}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Marketplace configuration
            {!isSuperAdmin ? ' (read-only — Super Admin required to save)' : ''}
          </p>
        </div>
        {isSuperAdmin ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!isDirty || saveMutation.isPending}
              onClick={() => setDraft(settingsQuery.data!.settings)}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={!isDirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : null}
      </div>

      {isDirty ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You have unsaved changes.
        </p>
      ) : null}
      {saveSuccess ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {saveSuccess}
        </p>
      ) : null}
      {saveError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>
      ) : null}

      <fieldset disabled={!isSuperAdmin} className="space-y-6 disabled:opacity-80">
        <SettingsSection title="General">
          <TextField
            label="Marketplace Name"
            value={draft.marketplace_name}
            onChange={(value) => updateField('marketplace_name', value)}
          />
          <TextAreaField
            label="Marketplace Description"
            value={draft.marketplace_description}
            onChange={(value) => updateField('marketplace_description', value)}
          />
          <TextField
            label="Contact Email"
            type="email"
            value={draft.contact_email}
            onChange={(value) => updateField('contact_email', value)}
          />
          <TextField
            label="Contact Phone"
            value={draft.contact_phone}
            onChange={(value) => updateField('contact_phone', value)}
          />
        </SettingsSection>

        <SettingsSection title="Listings">
          <ToggleField
            label="Auto Approve Listings"
            checked={draft.auto_approve_listings}
            onChange={(value) => updateField('auto_approve_listings', value)}
          />
          <NumberField
            label="Maximum Images Per Listing"
            value={draft.max_images_per_listing}
            onChange={(value) => updateField('max_images_per_listing', value)}
          />
          <NumberField
            label="Minimum Listing Price"
            value={draft.min_listing_price}
            onChange={(value) => updateField('min_listing_price', value)}
          />
          <NumberField
            label="Maximum Listing Price"
            value={draft.max_listing_price}
            onChange={(value) => updateField('max_listing_price', value)}
          />
        </SettingsSection>

        <SettingsSection title="Offers">
          <ToggleField
            label="Allow Offers"
            checked={draft.allow_offers}
            onChange={(value) => updateField('allow_offers', value)}
          />
        </SettingsSection>

        <SettingsSection title="Banners">
          <NumberField
            label="Maximum Active Banners"
            value={draft.max_active_banners}
            onChange={(value) => updateField('max_active_banners', value)}
          />
        </SettingsSection>

        <SettingsSection title="Maintenance">
          <ToggleField
            label="Maintenance Mode"
            checked={draft.maintenance_mode}
            onChange={(value) => updateField('maintenance_mode', value)}
          />
        </SettingsSection>
      </fieldset>
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm md:col-span-2">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700 md:col-span-2">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
