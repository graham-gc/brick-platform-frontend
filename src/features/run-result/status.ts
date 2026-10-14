export const BUSINESS_STATUS_COLORS: Record<string, string> = {
  passed: 'success',
  failed: 'error',
  not_configured: 'default',
  not_evaluated: 'warning',
};

export function businessStatusLabel(status?: string) {
  if (!status) return 'Not evaluated';
  if (status === 'not_configured') return 'No assertions';
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function assertionStatus(total?: number, passed?: number) {
  if (!total || total <= 0) {
    return { label: 'No assertions', color: 'default' };
  }

  const passedCount = passed ?? 0;
  return {
    label: `Assertion: ${passedCount}/${total}`,
    color: passedCount === total ? 'success' : 'error',
  };
}
