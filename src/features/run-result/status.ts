export const BUSINESS_STATUS_COLORS: Record<string, string> = {
  passed: 'success',
  failed: 'error',
  not_configured: 'default',
  not_evaluated: 'warning',
};

export function businessStatusLabel(status?: string) {
  if (!status) return 'Not evaluated';
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
