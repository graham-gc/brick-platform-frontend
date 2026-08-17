export interface HeaderEntry {
  name: string;
  value: string;
}

export function parseHeaderEntries(json?: string): HeaderEntry[] {
  if (!json?.trim()) return [];
  try {
    const value = JSON.parse(json);
    if (value == null || Array.isArray(value) || typeof value !== 'object') return [];
    return Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string | number | boolean] => (
        entry[1] != null && ['string', 'number', 'boolean'].includes(typeof entry[1])
      ))
      .map(([name, headerValue]) => ({ name, value: String(headerValue) }));
  } catch {
    return [];
  }
}

export function serializeHeaderEntries(entries?: HeaderEntry[]): string {
  return JSON.stringify(Object.fromEntries(
    (entries || []).map(({ name, value }) => [name.trim(), value])
  ));
}

export function isDynamicHeaderValue(value: string): boolean {
  return /\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*}}/.test(value);
}
