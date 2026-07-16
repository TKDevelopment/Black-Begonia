const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeDateOnly(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return null;
  }

  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toISOString().slice(0, 10);
}

export function parseDateOnlyForDisplay(value: string | null | undefined): Date | null {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(DATE_ONLY_PATTERN);

  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateOnlyForDisplay(
  value: string | null | undefined,
  fallback: string,
  options: Intl.DateTimeFormatOptions
): string {
  const date = parseDateOnlyForDisplay(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat('en-US', options).format(date);
}
