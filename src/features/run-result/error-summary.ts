export function conciseFlowError(message?: string): string | undefined {
  if (!message?.trim()) return undefined;
  const parts = message.split(';').map((part) => part.trim()).filter(Boolean);
  const failed = parts.filter((part) => /^Node \d+ failed:/i.test(part));
  const blocked = parts.filter((part) => /^Node \d+ blocked:/i.test(part));
  if (!blocked.length) return message;

  const blockedSummary = `${blocked.length} downstream ${blocked.length === 1
    ? 'node was'
    : 'nodes were'} not executed`;
  if (failed.length) return `${failed.join('; ')}; ${blockedSummary}`;
  return blockedSummary;
}
