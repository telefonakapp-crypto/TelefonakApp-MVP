import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ConfirmModal } from '../listings/ConfirmModal';
import type { AdminListItem } from '../../types/admin';

const MIN_PASSWORD_LENGTH = 8;

type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};

type ResetPasswordModalProps = {
  open: boolean;
  admin: AdminListItem | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (password: string) => void;
};

export function ResetPasswordModal({
  open,
  admin,
  loading = false,
  error,
  onClose,
  onSubmit,
}: ResetPasswordModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (open) reset({ password: '', confirmPassword: '' });
  }, [open, admin, reset]);

  return (
    <ConfirmModal
      open={open}
      title="Reset password"
      description={
        admin
          ? `Set a new password for ${admin.full_name} (${admin.email}).`
          : 'Set a new password for this admin.'
      }
      confirmLabel="Reset password"
      loading={loading}
      error={error}
      onCancel={onClose}
      onConfirm={handleSubmit((values) => onSubmit(values.password))}
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="reset-password" className="mb-1.5 block text-sm font-medium text-slate-700">
            New Password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: MIN_PASSWORD_LENGTH,
                message: `At least ${MIN_PASSWORD_LENGTH} characters`,
              },
            })}
          />
          {errors.password ? (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="reset-password-confirm"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Confirmation
          </label>
          <input
            id="reset-password-confirm"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            {...register('confirmPassword', {
              required: 'Please confirm the password',
              validate: (value, formValues) =>
                value === formValues.password || 'Passwords do not match',
            })}
          />
          {errors.confirmPassword ? (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          ) : null}
        </div>
      </div>
    </ConfirmModal>
  );
}
