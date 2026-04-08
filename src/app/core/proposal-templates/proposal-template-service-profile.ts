import {
  isProposalRendererFinalBalanceMode,
  ProposalRendererFinalBalanceMode,
  ProposalRendererStrategy,
} from './proposal-renderer-strategies';

export interface ProposalTemplateServiceProfile {
  documentTitle?: string;
  agreementTitle?: string;
  lineItemsKicker?: string;
  lineItemsTitle?: string;
  pricingEyebrow?: string;
  investmentTitle?: string;
  detailsSectionTitle?: string;
  serviceTypeLabel?: string;
  serviceDateLabel?: string;
  deliveryLocationLabel?: string;
  paymentTermsTitle?: string;
  retainerLabel?: string;
  finalBalanceLabel?: string;
  finalBalanceMode?: ProposalRendererFinalBalanceMode;
  finalBalanceFallback?: string;
  latePaymentLabel?: string;
  retainerCopy?: string;
  latePaymentCopy?: string;
  privacyTitle?: string;
  privacyCopy?: string;
  signatureTitle?: string;
  floristSignatureParty?: string;
  clientSignatureParty?: string;
}

type ProposalTemplateServiceProfileStringKey = Exclude<
  keyof ProposalTemplateServiceProfile,
  'finalBalanceMode'
>;

const SERVICE_PROFILE_STRING_KEYS: ProposalTemplateServiceProfileStringKey[] = [
  'documentTitle',
  'agreementTitle',
  'lineItemsKicker',
  'lineItemsTitle',
  'pricingEyebrow',
  'investmentTitle',
  'detailsSectionTitle',
  'serviceTypeLabel',
  'serviceDateLabel',
  'deliveryLocationLabel',
  'paymentTermsTitle',
  'retainerLabel',
  'finalBalanceLabel',
  'finalBalanceFallback',
  'latePaymentLabel',
  'retainerCopy',
  'latePaymentCopy',
  'privacyTitle',
  'privacyCopy',
  'signatureTitle',
  'floristSignatureParty',
  'clientSignatureParty',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeProposalTemplateServiceProfile(
  value: unknown
): ProposalTemplateServiceProfile {
  if (!isRecord(value)) {
    return {};
  }

  const profile: ProposalTemplateServiceProfile = {};

  SERVICE_PROFILE_STRING_KEYS.forEach((key) => {
    const normalized = normalizeOptionalString(value[key]);
    if (normalized) {
      profile[key] = normalized;
    }
  });

  if (isProposalRendererFinalBalanceMode(value['finalBalanceMode'])) {
    profile.finalBalanceMode = value['finalBalanceMode'];
  }

  return profile;
}

export function hasProposalTemplateServiceProfile(
  value: ProposalTemplateServiceProfile | null | undefined
): boolean {
  return Object.keys(normalizeProposalTemplateServiceProfile(value)).length > 0;
}

export function getTemplateServiceProfile(
  template:
    | {
        template_config?: Record<string, unknown> | null;
      }
    | null
    | undefined
): ProposalTemplateServiceProfile {
  return normalizeProposalTemplateServiceProfile(template?.template_config?.['service_profile']);
}

export function withTemplateServiceProfile(
  templateConfig: Record<string, unknown> | null | undefined,
  profile: ProposalTemplateServiceProfile | null | undefined
): Record<string, unknown> {
  const nextConfig = {
    ...(templateConfig ?? {}),
  };
  const normalizedProfile = normalizeProposalTemplateServiceProfile(profile);

  delete nextConfig['service_profile'];

  if (hasProposalTemplateServiceProfile(normalizedProfile)) {
    nextConfig['service_profile'] = normalizedProfile;
  }

  return nextConfig;
}

export function applyTemplateServiceProfile(
  baseStrategy: ProposalRendererStrategy,
  profile: ProposalTemplateServiceProfile | null | undefined
): ProposalRendererStrategy {
  const normalizedProfile = normalizeProposalTemplateServiceProfile(profile);

  return {
    ...baseStrategy,
    ...normalizedProfile,
    finalBalanceMode: normalizedProfile.finalBalanceMode ?? baseStrategy.finalBalanceMode,
  };
}

export const PROPOSAL_TEMPLATE_FINAL_BALANCE_MODE_OPTIONS: Array<{
  value: ProposalRendererFinalBalanceMode;
  label: string;
  description: string;
}> = [
  {
    value: 'event-minus-30',
    label: '30 Days Before Event',
    description: 'Use the event date minus thirty days.',
  },
  {
    value: 'event-minus-14',
    label: '14 Days Before Event',
    description: 'Use the event date minus fourteen days.',
  },
  {
    value: 'upon-approval',
    label: 'Due Upon Approval',
    description: 'Use the fallback copy as the due-date language.',
  },
  {
    value: 'subscription-schedule',
    label: 'Billing Schedule',
    description: 'Use the fallback copy for recurring or ongoing service billing.',
  },
];
