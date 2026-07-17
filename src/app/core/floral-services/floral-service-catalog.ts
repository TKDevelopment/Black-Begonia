import { ProposalRendererKey } from '../proposal-templates/proposal-renderer.types';

export type FloralServiceEventType = 'general' | 'wedding';
export type FloralServiceWorkflowMode = 'project' | 'subscription';
export type FloralServiceDocumentMode = 'proposal' | 'agreement';

export const FLORAL_SERVICE_DATABASE_VALUES = [
  'full-service wedding',
  'ceremony-only wedding',
  'reception-only wedding',
  'elopement',
  'engagement',
  'birthday',
  'funeral',
  'corporate',
  'bridal shower',
  'baby shower',
  'anniversary',
  'rehearsal',
  'proposal',
  'subscription',
  'private lessons',
  'other',
  'workshop',
  'private event',
] as const;

export type SupabaseLeadServiceType = typeof FLORAL_SERVICE_DATABASE_VALUES[number];

export interface FloralServiceDefinition {
  key: string;
  label: string;
  databaseValue: SupabaseLeadServiceType;
  eventType: FloralServiceEventType;
  workflowMode: FloralServiceWorkflowMode;
  documentMode: FloralServiceDocumentMode;
  // Export-rendering hint only. Proposal creation no longer depends on template selection.
  rendererKey: ProposalRendererKey;
  description: string;
  aliases?: string[];
}

export const FLORAL_SERVICE_CATALOG: FloralServiceDefinition[] = [
  {
    key: 'wedding-full-service',
    label: 'Full-Service Wedding',
    databaseValue: 'full-service wedding',
    eventType: 'wedding',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'wedding-full-service',
    description: 'Full wedding floral proposals with ceremony and reception details.',
    aliases: ['full-service wedding', 'full service wedding', 'wedding'],
  },
  {
    key: 'wedding-ceremony-only',
    label: 'Ceremony-Only Wedding',
    databaseValue: 'ceremony-only wedding',
    eventType: 'wedding',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'wedding-ceremony-only',
    description: 'Wedding proposals focused on ceremony florals and ceremony logistics.',
    aliases: ['ceremony-only wedding', 'ceremony only wedding'],
  },
  {
    key: 'wedding-reception-only',
    label: 'Reception-Only Wedding',
    databaseValue: 'reception-only wedding',
    eventType: 'wedding',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'wedding-reception-only',
    description: 'Wedding proposals focused on reception florals and reception logistics.',
    aliases: ['reception-only wedding', 'reception only wedding'],
  },
  {
    key: 'elopement',
    label: 'Elopement',
    databaseValue: 'elopement',
    eventType: 'wedding',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'elopement',
    description: 'Intimate wedding floral services with a streamlined proposal structure.',
  },
  {
    key: 'engagement',
    label: 'Engagements',
    databaseValue: 'engagement',
    eventType: 'wedding',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'engagement',
    description: 'Wedding-adjacent engagement floral services and celebration design.',
    aliases: ['engagement'],
  },
  {
    key: 'baby-shower',
    label: 'Baby Showers',
    databaseValue: 'baby shower',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'general-event',
    description: 'Celebration florals for baby showers and related gatherings.',
    aliases: ['baby shower'],
  },
  {
    key: 'bridal-shower',
    label: 'Bridal Showers',
    databaseValue: 'bridal shower',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'bridal-shower',
    description: 'Bridal shower proposals with celebration-focused floral language.',
    aliases: ['bridal shower'],
  },
  {
    key: 'quinceanera-celebration',
    label: 'Quinceanera Celebrations',
    databaseValue: 'private event',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'general-event',
    description: 'Floral proposals for quinceaneras and milestone coming-of-age events.',
    aliases: ['quinceanera', 'quinceanera celebration'],
  },
  {
    key: 'memorial-florals',
    label: 'Memorial Florals',
    databaseValue: 'funeral',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'memorial',
    description: 'Sympathy and memorial floral services with more sensitive event framing.',
    aliases: ['funeral', 'memorial', 'celebration of life', 'memorial flowers'],
  },
  {
    key: 'rehearsal-dinner',
    label: 'Rehearsal Dinners',
    databaseValue: 'rehearsal',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'general-event',
    description: 'Dinner-focused floral services for rehearsal events and related celebrations.',
    aliases: ['rehearsal', 'rehearsal dinner'],
  },
  {
    key: 'anniversary-dinner',
    label: 'Anniversary Dinners',
    databaseValue: 'anniversary',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'general-event',
    description: 'Anniversary floral services for intimate dinners and hosted celebrations.',
    aliases: ['anniversary', 'anniversary dinner'],
  },
  {
    key: 'private-gathering',
    label: 'Private Gatherings',
    databaseValue: 'private event',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'general-event',
    description: 'Flexible general-event florals for hosted dinners, parties, and private events.',
    aliases: ['private event', 'other'],
  },
  {
    key: 'birthday-celebration',
    label: 'Birthday Celebrations',
    databaseValue: 'birthday',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'general-event',
    description: 'Birthday and milestone celebration floral proposals.',
    aliases: ['birthday'],
  },
  {
    key: 'proposal-florals',
    label: 'Proposal Florals',
    databaseValue: 'proposal',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'engagement',
    description: 'Proposal-day floral services that stay in the project lifecycle.',
    aliases: ['proposal'],
  },
  {
    key: 'flower-bar',
    label: 'Build-Your-Own Flower Bar',
    databaseValue: 'private event',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'flower-bar',
    description: 'Interactive flower bar experiences with project-based planning and setup.',
    aliases: ['flower bar', 'build your own flower bar'],
  },
  {
    key: 'corporate-event',
    label: 'Corporate Events',
    databaseValue: 'corporate',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'general-event',
    description: 'Corporate floral services for launches, dinners, offices, and hosted events.',
    aliases: ['corporate', 'corporate event'],
  },
  {
    key: 'private-workshop',
    label: 'Private Workshops',
    databaseValue: 'workshop',
    eventType: 'general',
    workflowMode: 'project',
    documentMode: 'proposal',
    rendererKey: 'workshop-private',
    description: 'Hands-on workshop experiences that still move through the project lifecycle.',
    aliases: ['workshop', 'workshop opportunity', 'private workshop'],
  },
  {
    key: 'floral-subscription',
    label: 'Floral Subscriptions',
    databaseValue: 'subscription',
    eventType: 'general',
    workflowMode: 'subscription',
    documentMode: 'agreement',
    rendererKey: 'basic-agreement',
    description: 'Recurring floral services that should move through the subscription lifecycle.',
    aliases: ['subscription', 'floral subscription', 'floral subscriptions'],
  },
  {
    key: 'private-lesson',
    label: 'Private Lessons',
    databaseValue: 'private lessons',
    eventType: 'general',
    workflowMode: 'subscription',
    documentMode: 'agreement',
    rendererKey: 'basic-agreement',
    description: 'Private lesson bookings that share the same subscription-style lifecycle.',
    aliases: ['private lesson', 'private lessons'],
  },
];

function normalizeCatalogValue(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FLORAL_SERVICE_LOOKUP = new Map<string, FloralServiceDefinition>();
const SUPABASE_LEAD_SERVICE_TYPE_LOOKUP = new Map<string, SupabaseLeadServiceType>();

FLORAL_SERVICE_DATABASE_VALUES.forEach((serviceType) => {
  SUPABASE_LEAD_SERVICE_TYPE_LOOKUP.set(
    normalizeCatalogValue(serviceType),
    serviceType
  );
});

for (const service of FLORAL_SERVICE_CATALOG) {
  const indexValues = [service.key, service.label, ...(service.aliases ?? [])];

  indexValues.forEach((value) => {
    const normalized = normalizeCatalogValue(value);
    if (normalized && !FLORAL_SERVICE_LOOKUP.has(normalized)) {
      FLORAL_SERVICE_LOOKUP.set(normalized, service);
    }
  });
}

export function getFloralServicesForEventType(
  eventType: FloralServiceEventType
): FloralServiceDefinition[] {
  return FLORAL_SERVICE_CATALOG.filter((service) => service.eventType === eventType);
}

export function normalizeFloralServiceEventType(
  value: string | null | undefined
): FloralServiceEventType | null {
  return value === 'general' || value === 'wedding' ? value : null;
}

export function findFloralService(
  value: string | null | undefined,
  eventType?: FloralServiceEventType | null
): FloralServiceDefinition | null {
  const normalized = normalizeCatalogValue(value);

  if (!normalized) {
    return null;
  }

  const matched = FLORAL_SERVICE_LOOKUP.get(normalized) ?? null;

  if (!matched) {
    return null;
  }

  if (eventType && matched.eventType !== eventType) {
    return null;
  }

  return matched;
}

export function resolveFloralServiceLabel(
  value: string | null | undefined,
  eventType?: FloralServiceEventType | null
): string | null {
  return findFloralService(value, eventType)?.label ?? null;
}

export function resolveFloralServiceDatabaseValue(
  value: string | null | undefined,
  eventType?: FloralServiceEventType | null
): SupabaseLeadServiceType | null {
  const normalized = normalizeCatalogValue(value);

  if (!normalized) {
    return null;
  }

  const directDatabaseValue = SUPABASE_LEAD_SERVICE_TYPE_LOOKUP.get(normalized);

  if (directDatabaseValue) {
    return directDatabaseValue;
  }

  return findFloralService(value, eventType)?.databaseValue ?? null;
}

export function getFloralServiceWorkflowMode(
  value: string | null | undefined,
  eventType?: FloralServiceEventType | null
): FloralServiceWorkflowMode | null {
  return findFloralService(value, eventType)?.workflowMode ?? null;
}

export function getFloralServiceDocumentMode(
  value: string | null | undefined,
  eventType?: FloralServiceEventType | null
): FloralServiceDocumentMode | null {
  return findFloralService(value, eventType)?.documentMode ?? null;
}
