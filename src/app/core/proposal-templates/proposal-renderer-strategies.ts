import { ProposalRendererKey } from './proposal-renderer-registry';

export interface ProposalRendererStrategy {
  key: ProposalRendererKey;
  agreementTitle: string;
  detailLayout: 'dual-venue' | 'ceremony-event' | 'reception-event' | 'event';
  deliveryLocationMode: 'dual-venue' | 'ceremony' | 'reception' | 'event';
  cityStatePreference: 'reception' | 'ceremony-first';
  retainerCopy: string;
  latePaymentCopy: string;
}

const PROPOSAL_RENDERER_STRATEGIES: Record<ProposalRendererKey, ProposalRendererStrategy> = {
  'wedding-full-service': {
    key: 'wedding-full-service',
    agreementTitle: 'Wedding Floral Services Agreement',
    detailLayout: 'dual-venue',
    deliveryLocationMode: 'dual-venue',
    cityStatePreference: 'reception',
    retainerCopy:
      'A signed contract and non-refundable retainer are required to reserve the event date.',
    latePaymentCopy:
      'Any payment received after the due date may delay production, delivery scheduling, or event execution.',
  },
  'wedding-ceremony-only': {
    key: 'wedding-ceremony-only',
    agreementTitle: 'Ceremony Floral Services Agreement',
    detailLayout: 'ceremony-event',
    deliveryLocationMode: 'ceremony',
    cityStatePreference: 'ceremony-first',
    retainerCopy:
      'A signed contract and non-refundable retainer are required to reserve the event date.',
    latePaymentCopy:
      'Any payment received after the due date may delay production, delivery scheduling, or event execution.',
  },
  'wedding-reception-only': {
    key: 'wedding-reception-only',
    agreementTitle: 'Reception Floral Services Agreement',
    detailLayout: 'reception-event',
    deliveryLocationMode: 'reception',
    cityStatePreference: 'ceremony-first',
    retainerCopy:
      'A signed contract and non-refundable retainer are required to reserve the event date.',
    latePaymentCopy:
      'Any payment received after the due date may delay production, delivery scheduling, or event execution.',
  },
  elopement: {
    key: 'elopement',
    agreementTitle: 'Elopement Floral Services Agreement',
    detailLayout: 'ceremony-event',
    deliveryLocationMode: 'ceremony',
    cityStatePreference: 'ceremony-first',
    retainerCopy:
      'A signed contract and non-refundable retainer are required to reserve the event date.',
    latePaymentCopy:
      'Any payment received after the due date may delay production, delivery scheduling, or event execution.',
  },
  engagement: {
    key: 'engagement',
    agreementTitle: 'Engagement Floral Services Agreement',
    detailLayout: 'event',
    deliveryLocationMode: 'event',
    cityStatePreference: 'ceremony-first',
    retainerCopy:
      'A signed agreement and retainer are required before proposal-day floral production and scheduling are confirmed.',
    latePaymentCopy:
      'Late payment may delay floral production, delivery timing, or on-site setup for the event.',
  },
  'bridal-shower': {
    key: 'bridal-shower',
    agreementTitle: 'Bridal Shower Floral Services Agreement',
    detailLayout: 'event',
    deliveryLocationMode: 'event',
    cityStatePreference: 'ceremony-first',
    retainerCopy:
      'A signed agreement and retainer are required before floral production, delivery scheduling, and event preparation are confirmed.',
    latePaymentCopy:
      'Any payment received after the due date may delay floral production, delivery scheduling, or event execution.',
  },
  'general-event': {
    key: 'general-event',
    agreementTitle: 'Event Floral Services Agreement',
    detailLayout: 'event',
    deliveryLocationMode: 'event',
    cityStatePreference: 'ceremony-first',
    retainerCopy:
      'A signed agreement and retainer are required before floral production, delivery scheduling, and event preparation are confirmed.',
    latePaymentCopy:
      'Any payment received after the due date may delay floral production, delivery scheduling, or event execution.',
  },
};

export function getProposalRendererStrategy(
  key: ProposalRendererKey
): ProposalRendererStrategy {
  return PROPOSAL_RENDERER_STRATEGIES[key];
}
