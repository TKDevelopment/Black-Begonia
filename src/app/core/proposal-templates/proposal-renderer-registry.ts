import {
  findFloralService,
  FloralServiceEventType,
} from '../floral-services/floral-service-catalog';
import { ProposalRendererKey } from './proposal-renderer.types';

export type { ProposalRendererKey } from './proposal-renderer.types';

export interface ProposalRendererOption {
  key: ProposalRendererKey;
  label: string;
  description: string;
}

export const PROPOSAL_RENDERER_OPTIONS: ProposalRendererOption[] = [
  {
    key: 'wedding-full-service',
    label: 'Wedding Full Service',
    description: 'Ceremony and reception details with wedding-specific proposal framing.',
  },
  {
    key: 'wedding-ceremony-only',
    label: 'Wedding Ceremony Only',
    description: 'Focused wedding rendering for ceremony-only floral proposals.',
  },
  {
    key: 'wedding-reception-only',
    label: 'Wedding Reception Only',
    description: 'Reception-specific rendering and event detail emphasis.',
  },
  {
    key: 'elopement',
    label: 'Elopement',
    description: 'Simplified romantic event structure for intimate wedding services.',
  },
  {
    key: 'engagement',
    label: 'Engagement / Proposal',
    description: 'Proposal and engagement event rendering with lighter structure.',
  },
  {
    key: 'bridal-shower',
    label: 'Bridal Shower',
    description: 'Celebration-focused rendering for bridal shower floral services.',
  },
  {
    key: 'general-event',
    label: 'Event Standard',
    description: 'Flexible event rendering for parties, corporate work, and non-wedding services.',
  },
  {
    key: 'memorial',
    label: 'Memorial Florals',
    description: 'Sensitive service framing for memorials, sympathy work, and celebration-of-life florals.',
  },
  {
    key: 'flower-bar',
    label: 'Flower Bar',
    description: 'Interactive flower bar rendering with setup-focused language and payment timing.',
  },
  {
    key: 'workshop-private',
    label: 'Private Workshop',
    description: 'Workshop-specific rendering for hosted floral classes and project-based instruction.',
  },
  {
    key: 'basic-agreement',
    label: 'Basic Agreement',
    description: 'Service agreement rendering for subscriptions, private lessons, and non-proposal engagements.',
  },
];

const PROPOSAL_RENDERER_KEY_SET = new Set<string>(
  PROPOSAL_RENDERER_OPTIONS.map((option) => option.key)
);

function normalizeRendererHint(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[-_\s]+/g, ' ');
}

export function isProposalRendererKey(value: unknown): value is ProposalRendererKey {
  return typeof value === 'string' && PROPOSAL_RENDERER_KEY_SET.has(value);
}

export function normalizeProposalRendererKey(
  value: string | null | undefined
): ProposalRendererKey | null {
  if (!value) return null;
  return isProposalRendererKey(value) ? value : null;
}

export function deriveProposalRendererKeyFromServiceType(
  value: string | null | undefined,
  eventType?: FloralServiceEventType | null
): ProposalRendererKey {
  const matchedService = findFloralService(value, eventType);

  if (matchedService) {
    return matchedService.rendererKey;
  }

  const normalized = normalizeRendererHint(value);

  if (!normalized) {
    return 'general-event';
  }

  if (normalized.includes('ceremony only')) {
    return 'wedding-ceremony-only';
  }

  if (normalized.includes('reception only')) {
    return 'wedding-reception-only';
  }

  if (normalized.includes('full service')) {
    return 'wedding-full-service';
  }

  if (normalized.includes('elopement')) {
    return 'elopement';
  }

  if (normalized.includes('engagement') || normalized.includes('proposal')) {
    return 'engagement';
  }

  if (normalized.includes('bridal shower')) {
    return 'bridal-shower';
  }

  if (
    normalized.includes('memorial') ||
    normalized.includes('funeral') ||
    normalized.includes('celebration of life')
  ) {
    return 'memorial';
  }

  if (normalized.includes('flower bar')) {
    return 'flower-bar';
  }

  if (normalized.includes('workshop')) {
    return 'workshop-private';
  }

  if (
    normalized.includes('subscription') ||
    normalized.includes('lesson') ||
    normalized.includes('agreement')
  ) {
    return 'basic-agreement';
  }

  if (normalized.includes('wedding')) {
    return 'wedding-full-service';
  }

  return 'general-event';
}

export function getProposalRendererOption(
  key: ProposalRendererKey | null | undefined
): ProposalRendererOption | null {
  return PROPOSAL_RENDERER_OPTIONS.find((option) => option.key === key) ?? null;
}

export function getTemplateRendererKey(
  template:
    | {
        template_config?: Record<string, unknown> | null;
      }
    | null
    | undefined
): ProposalRendererKey | null {
  const rawValue = template?.template_config?.['renderer_key'];
  return typeof rawValue === 'string' ? normalizeProposalRendererKey(rawValue) : null;
}

export function resolveTemplateRendererKey(
  template:
    | {
        name?: string | null;
        template_key?: string | null;
        template_config?: Record<string, unknown> | null;
      }
    | null
    | undefined
): ProposalRendererKey {
  return (
    getTemplateRendererKey(template) ??
    deriveProposalRendererKeyFromServiceType(template?.template_key ?? template?.name)
  );
}

export function withTemplateRendererKey(
  templateConfig: Record<string, unknown> | null | undefined,
  rendererKey: ProposalRendererKey
): Record<string, unknown> {
  return {
    ...(templateConfig ?? {}),
    renderer_key: rendererKey,
  };
}
