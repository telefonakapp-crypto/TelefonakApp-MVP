import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  ADMIN_ROLE_OPTIONS,
  type AdminFormValues,
  type AdminListItem,
  type AdminRole,
} from '../../types/admin';

const MIN_PASSWORD_LENGTH = 8;

type AdminFormProps = {
  open: boolean;
  mode: 'create' | 'edit';
  admin?: AdminListItem | null;
  isSelf?: boolean;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: AdminFormValues) => void;
};

function toFormValues(admin?: AdminListItem | null): AdminFormValues {
  return {
    full_name: admin?.full_name || '',
    email: admin?.email || '',
    password: '',
    role: (admin?.role as AdminRole) || 'viewer',
    is_active: admin?.is_active ?? true,
  };
}

export function AdminForm({
  open,
  mode,
  admin,
  isSelf = false,
  submitting = false,
  error,
  onClose,
  onSubmit,
}: AdminFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminFormValues>({
    defaultValues: toFormValues(admin),
  });

  useEffect(() => {
    if (open) reset(toFormValues(admin));
  }, [open, admin, reset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close form"
        className="absolute inset-0 bg-slate-900/40"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-xl md:max-w-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === 'create' ? 'Create admin' : 'Edit admin'}
            </h2>
            <p className="text-sm text-slate-500">Admin Web account</p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div>
              <label htmlFor="admin-full-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                Full Name <span className="text-red-600">*</span>
              </label>
              <input
                id="admin-full-name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                {...register('full_name', { required: 'Full name is required' })}
              />
              {errors.full_name ? (
                <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                id="admin-email"
                type="email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email',
                  },
                })}
              />
              {errors.email ? (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              ) : null}
            </div>

            {mode === 'create' ? (
              <div>
                <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password <span className="text-red-600">*</span>
                </label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: MIN_PASSWORD_LENGTH,
                      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
                    },
                  })}
                />
                {errors.password ? (
                  <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label htmlFor="admin-role" className="mb-1.5 block text-sm font-medium text-slate-700">
                Role <span className="text-red-600">*</span>
              </label>
              <select
                id="admin-role"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                {...register('role', { required: 'Role is required' })}
              >
                {ADMIN_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {mode === 'edit' ? (
              <label
                className={`flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700 ${
                  isSelf ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  disabled={isSelf}
                  {...register('is_active')}
                />
                Active
                {isSelf ? (
                  <span className="text-xs text-slate-400">You cannot disable yourself</span>
                ) : null}
              </label>
            ) : null}

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
          </div>

          <div className="flex gap-2 border-t border-slate-200 p-4">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : mode === 'create' ? 'Create admin' : 'Save changes'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
