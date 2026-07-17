export const LEAD_SOURCE_VALUES = [
  'instagram',
  'facebook',
  'google',
  'pinterest',
  'the knot',
  'wedding wire',
  'yelp',
  'venue partner',
  'bridal show',
  'other',
  'website',
] as const;

export type SupabaseLeadSource = typeof LEAD_SOURCE_VALUES[number];

const LEAD_SOURCE_ALIASES = new Map<string, SupabaseLeadSource>([
  ['personal referral', 'other'],
  ['referral', 'other'],
  ['crm', 'other'],
]);

export function formatLeadSourceLabel(source: SupabaseLeadSource): string {
  return source.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function normalizeEnumInput(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLeadSource(
  source: string | null | undefined
): SupabaseLeadSource {
  const normalized = normalizeEnumInput(source);

  if (!normalized) {
    return 'other';
  }

  const directSource = LEAD_SOURCE_VALUES.find(
    (leadSource) => normalizeEnumInput(leadSource) === normalized
  );

  return directSource ?? LEAD_SOURCE_ALIASES.get(normalized) ?? 'other';
}
