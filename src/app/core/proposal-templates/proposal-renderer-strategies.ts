import { ProposalRendererKey } from './proposal-renderer-registry';

export type ProposalRendererFinalBalanceMode =
  | 'event-minus-30'
  | 'event-minus-14'
  | 'upon-approval'
  | 'subscription-schedule';

export const PROPOSAL_RENDERER_FINAL_BALANCE_MODE_VALUES: ProposalRendererFinalBalanceMode[] = [
  'event-minus-30',
  'event-minus-14',
  'upon-approval',
  'subscription-schedule',
];

const PROPOSAL_RENDERER_FINAL_BALANCE_MODE_SET = new Set<string>(
  PROPOSAL_RENDERER_FINAL_BALANCE_MODE_VALUES
);

export interface ProposalRendererStrategy {
  key: ProposalRendererKey;
  documentTitle: string;
  agreementTitle: string;
  detailLayout: 'dual-venue' | 'ceremony-event' | 'reception-event' | 'event';
  deliveryLocationMode: 'dual-venue' | 'ceremony' | 'reception' | 'event';
  cityStatePreference: 'reception' | 'ceremony-first';
  lineItemsKicker: string;
  lineItemsTitle: string;
  pricingEyebrow: string;
  investmentTitle: string;
  detailsSectionTitle: string;
  serviceTypeLabel: string;
  serviceDateLabel: string;
  deliveryLocationLabel: string;
  paymentTermsTitle: string;
  retainerLabel: string;
  finalBalanceLabel: string;
  finalBalanceMode: ProposalRendererFinalBalanceMode;
  finalBalanceFallback: string;
  latePaymentLabel: string;
  retainerCopy: string;
  latePaymentCopy: string;
  privacyTitle: string;
  privacyCopy: string;
  signatureTitle: string;
  floristSignatureParty: string;
  clientSignatureParty: string;
}

const DEFAULT_RENDERER_SECTION_COPY: Pick<
  ProposalRendererStrategy,
  | 'privacyTitle'
  | 'privacyCopy'
  | 'signatureTitle'
  | 'floristSignatureParty'
  | 'clientSignatureParty'
> = {
  privacyTitle: 'Privacy Policy',
  privacyCopy:
    'Your contact information and event details are used solely for proposal preparation, booking communication, and service fulfillment.',
  signatureTitle: 'Signature & Acceptance',
  floristSignatureParty: 'Black Begonia Floral Design, LLC',
  clientSignatureParty: '{{customer_name}}',
};

function defineStrategy(
  strategy: Omit<ProposalRendererStrategy, keyof typeof DEFAULT_RENDERER_SECTION_COPY> &
    Partial<Pick<ProposalRendererStrategy, keyof typeof DEFAULT_RENDERER_SECTION_COPY>>
): ProposalRendererStrategy {
  return {
    ...DEFAULT_RENDERER_SECTION_COPY,
    ...strategy,
  };
}

const PROPOSAL_RENDERER_STRATEGIES: Record<ProposalRendererKey, ProposalRendererStrategy> = {
  'wedding-full-service': defineStrategy({
    key: 'wedding-full-service',
    documentTitle: 'Floral Proposal',
    agreementTitle: 'Wedding Floral Services Agreement',
    detailLayout: 'dual-venue',
    deliveryLocationMode: 'dual-venue',
    cityStatePreference: 'reception',
    lineItemsKicker: 'Selections',
    lineItemsTitle: 'Floral Line Items',
    pricingEyebrow: 'Pricing',
    investmentTitle: 'Investment',
    detailsSectionTitle: '1. Event Details',
    serviceTypeLabel: 'Service Type',
    serviceDateLabel: 'Event Date',
    deliveryLocationLabel: 'Delivery & Setup Location',
    paymentTermsTitle: '4. Payment Terms',
    retainerLabel: 'Retainer',
    finalBalanceLabel: 'Final Balance Due Date',
    finalBalanceMode: 'event-minus-30',
    finalBalanceFallback: '30 days prior to event',
    latePaymentLabel: 'Late Payments',
    retainerCopy:
      'A signed contract and non-refundable retainer are required to reserve the event date.',
    latePaymentCopy:
      'Any payment received after the due date may delay production, delivery scheduling, or event execution.',
  }),
  'wedding-ceremony-only': defineStrategy({
    key: 'wedding-ceremony-only',
    documentTitle: 'Floral Proposal',
    agreementTitle: 'Ceremony Floral Services Agreement',
    detailLayout: 'ceremony-event',
    deliveryLocationMode: 'ceremony',
    cityStatePreference: 'ceremony-first',
    lineItemsKicker: 'Selections',
    lineItemsTitle: 'Ceremony Floral Line Items',
    pricingEyebrow: 'Pricing',
    investmentTitle: 'Investment',
    detailsSectionTitle: '1. Event Details',
    serviceTypeLabel: 'Service Type',
    serviceDateLabel: 'Event Date',
    deliveryLocationLabel: 'Delivery & Setup Location',
    paymentTermsTitle: '4. Payment Terms',
    retainerLabel: 'Retainer',
    finalBalanceLabel: 'Final Balance Due Date',
    finalBalanceMode: 'event-minus-30',
    finalBalanceFallback: '30 days prior to event',
    latePaymentLabel: 'Late Payments',
    retainerCopy:
      'A signed contract and non-refundable retainer are required to reserve the event date.',
    latePaymentCopy:
      'Any payment received after the due date may delay production, delivery scheduling, or event execution.',
  }),
  'wedding-reception-only': defineStrategy({
    key: 'wedding-reception-only',
    documentTitle: 'Floral Proposal',
    agreementTitle: 'Reception Floral Services Agreement',
    detailLayout: 'reception-event',
    deliveryLocationMode: 'reception',
    cityStatePreference: 'ceremony-first',
    lineItemsKicker: 'Selections',
    lineItemsTitle: 'Reception Floral Line Items',
    pricingEyebrow: 'Pricing',
    investmentTitle: 'Investment',
    detailsSectionTitle: '1. Event Details',
    serviceTypeLabel: 'Service Type',
    serviceDateLabel: 'Event Date',
    deliveryLocationLabel: 'Delivery & Setup Location',
    paymentTermsTitle: '4. Payment Terms',
    retainerLabel: 'Retainer',
    finalBalanceLabel: 'Final Balance Due Date',
    finalBalanceMode: 'event-minus-30',
    finalBalanceFallback: '30 days prior to event',
    latePaymentLabel: 'Late Payments',
    retainerCopy:
      'A signed contract and non-refundable retainer are required to reserve the event date.',
    latePaymentCopy:
      'Any payment received after the due date may delay production, delivery scheduling, or event execution.',
  }),
  elopement: defineStrategy({
    key: 'elopement',
    documentTitle: 'Floral Proposal',
    agreementTitle: 'Elopement Floral Services Agreement',
    detailLayout: 'ceremony-event',
    deliveryLocationMode: 'ceremony',
    cityStatePreference: 'ceremony-first',
    lineItemsKicker: 'Selections',
    lineItemsTitle: 'Elopement Floral Line Items',
    pricingEyebrow: 'Pricing',
    investmentTitle: 'Investment',
    detailsSectionTitle: '1. Event Details',
    serviceTypeLabel: 'Service Type',
    serviceDateLabel: 'Event Date',
    deliveryLocationLabel: 'Delivery & Setup Location',
    paymentTermsTitle: '4. Payment Terms',
    retainerLabel: 'Retainer',
    finalBalanceLabel: 'Final Balance Due Date',
    finalBalanceMode: 'event-minus-30',
    finalBalanceFallback: '30 days prior to event',
    latePaymentLabel: 'Late Payments',
    retainerCopy:
      'A signed contract and non-refundable retainer are required to reserve the event date.',
    latePaymentCopy:
      'Any payment received after the due date may delay production, delivery scheduling, or event execution.',
  }),
  engagement: defineStrategy({
    key: 'engagement',
    documentTitle: 'Floral Proposal',
    agreementTitle: 'Engagement Floral Services Agreement',
    detailLayout: 'event',
    deliveryLocationMode: 'event',
    cityStatePreference: 'ceremony-first',
    lineItemsKicker: 'Selections',
    lineItemsTitle: 'Proposal Floral Selections',
    pricingEyebrow: 'Pricing',
    investmentTitle: 'Proposal Investment',
    detailsSectionTitle: '1. Event Details',
    serviceTypeLabel: 'Service Type',
    serviceDateLabel: 'Event Date',
    deliveryLocationLabel: 'Delivery & Setup Location',
    paymentTermsTitle: '4. Payment Terms',
    retainerLabel: 'Retainer',
    finalBalanceLabel: 'Final Balance Due Date',
    finalBalanceMode: 'event-minus-14',
    finalBalanceFallback: '14 days prior to event',
    latePaymentLabel: 'Late Payments',
    retainerCopy:
      'A signed agreement and retainer are required before proposal-day floral production and scheduling are confirmed.',
    latePaymentCopy:
      'Late payment may delay floral production, delivery timing, or on-site setup for the event.',
  }),
  'bridal-shower': defineStrategy({
    key: 'bridal-shower',
    documentTitle: 'Floral Proposal',
    agreementTitle: 'Bridal Shower Floral Services Agreement',
    detailLayout: 'event',
    deliveryLocationMode: 'event',
    cityStatePreference: 'ceremony-first',
    lineItemsKicker: 'Selections',
    lineItemsTitle: 'Event Floral Selections',
    pricingEyebrow: 'Pricing',
    investmentTitle: 'Investment',
    detailsSectionTitle: '1. Event Details',
    serviceTypeLabel: 'Service Type',
    serviceDateLabel: 'Event Date',
    deliveryLocationLabel: 'Delivery & Setup Location',
    paymentTermsTitle: '4. Payment Terms',
    retainerLabel: 'Retainer',
    finalBalanceLabel: 'Final Balance Due Date',
    finalBalanceMode: 'event-minus-14',
    finalBalanceFallback: '14 days prior to event',
    latePaymentLabel: 'Late Payments',
    retainerCopy:
      'A signed agreement and retainer are required before floral production, delivery scheduling, and event preparation are confirmed.',
    latePaymentCopy:
      'Any payment received after the due date may delay floral production, delivery scheduling, or event execution.',
  }),
  'general-event': defineStrategy({
    key: 'general-event',
    documentTitle: 'Floral Proposal',
    agreementTitle: 'Event Floral Services Agreement',
    detailLayout: 'event',
    deliveryLocationMode: 'event',
    cityStatePreference: 'ceremony-first',
    lineItemsKicker: 'Selections',
    lineItemsTitle: 'Event Floral Line Items',
    pricingEyebrow: 'Pricing',
    investmentTitle: 'Investment',
    detailsSectionTitle: '1. Event Details',
    serviceTypeLabel: 'Service Type',
    serviceDateLabel: 'Event Date',
    deliveryLocationLabel: 'Delivery & Setup Location',
    paymentTermsTitle: '4. Payment Terms',
    retainerLabel: 'Retainer',
    finalBalanceLabel: 'Final Balance Due Date',
    finalBalanceMode: 'event-minus-30',
    finalBalanceFallback: '30 days prior to event',
    latePaymentLabel: 'Late Payments',
    retainerCopy:
      'A signed agreement and retainer are required before floral production, delivery scheduling, and event preparation are confirmed.',
    latePaymentCopy:
      'Any payment received after the due date may delay floral production, delivery scheduling, or event execution.',
  }),
  memorial: defineStrategy({
    key: 'memorial',
    documentTitle: 'Service Agreement',
    agreementTitle: 'Memorial Floral Services Agreement',
    detailLayout: 'event',
    deliveryLocationMode: 'event',
    cityStatePreference: 'ceremony-first',
    lineItemsKicker: 'Design Plan',
    lineItemsTitle: 'Memorial Floral Selections',
    pricingEyebrow: 'Service Pricing',
    investmentTitle: 'Investment',
    detailsSectionTitle: '1. Service Details',
    serviceTypeLabel: 'Service Type',
    serviceDateLabel: 'Service Date',
    deliveryLocationLabel: 'Delivery Location',
    paymentTermsTitle: '2. Payment Terms',
    retainerLabel: 'Approval & Deposit',
    finalBalanceLabel: 'Invoice Due',
    finalBalanceMode: 'upon-approval',
    finalBalanceFallback: 'Due upon approval',
    latePaymentLabel: 'Timing',
    retainerCopy:
      'Because memorial work is often time-sensitive, signed approval and any requested deposit are required before sourcing and design begin.',
    latePaymentCopy:
      'Delays in approval or payment may affect flower availability, delivery timing, or necessary substitutions.',
  }),
  'flower-bar': defineStrategy({
    key: 'flower-bar',
    documentTitle: 'Floral Proposal',
    agreementTitle: 'Flower Bar Services Agreement',
    detailLayout: 'event',
    deliveryLocationMode: 'event',
    cityStatePreference: 'ceremony-first',
    lineItemsKicker: 'Experience Design',
    lineItemsTitle: 'Flower Bar Inclusions',
    pricingEyebrow: 'Event Pricing',
    investmentTitle: 'Flower Bar Investment',
    detailsSectionTitle: '1. Event Details',
    serviceTypeLabel: 'Service Type',
    serviceDateLabel: 'Event Date',
    deliveryLocationLabel: 'Setup Location',
    paymentTermsTitle: '4. Payment Terms',
    retainerLabel: 'Reservation Deposit',
    finalBalanceLabel: 'Final Balance Due Date',
    finalBalanceMode: 'event-minus-14',
    finalBalanceFallback: '14 days prior to event',
    latePaymentLabel: 'Late Payments',
    retainerCopy:
      'A signed agreement and reservation deposit are required before the flower bar inventory, staffing, and setup window are reserved.',
    latePaymentCopy:
      'Late payment may affect flower sourcing, staffing confirmation, or installation timing for the flower bar.',
  }),
  'workshop-private': defineStrategy({
    key: 'workshop-private',
    documentTitle: 'Floral Proposal',
    agreementTitle: 'Private Floral Workshop Agreement',
    detailLayout: 'event',
    deliveryLocationMode: 'event',
    cityStatePreference: 'ceremony-first',
    lineItemsKicker: 'Workshop Plan',
    lineItemsTitle: 'Workshop Inclusions',
    pricingEyebrow: 'Workshop Pricing',
    investmentTitle: 'Workshop Investment',
    detailsSectionTitle: '1. Workshop Details',
    serviceTypeLabel: 'Workshop Type',
    serviceDateLabel: 'Workshop Date',
    deliveryLocationLabel: 'Workshop Location',
    paymentTermsTitle: '4. Payment Terms',
    retainerLabel: 'Reservation Deposit',
    finalBalanceLabel: 'Final Balance Due Date',
    finalBalanceMode: 'event-minus-14',
    finalBalanceFallback: '14 days prior to workshop',
    latePaymentLabel: 'Late Payments',
    retainerCopy:
      'A signed agreement and reservation deposit are required before instruction time, materials, and workshop scheduling are confirmed.',
    latePaymentCopy:
      'Late payment may affect material sourcing, scheduling, or participant preparation for the workshop.',
  }),
  'basic-agreement': defineStrategy({
    key: 'basic-agreement',
    documentTitle: 'Service Agreement',
    agreementTitle: 'Floral Service Agreement',
    detailLayout: 'event',
    deliveryLocationMode: 'event',
    cityStatePreference: 'ceremony-first',
    lineItemsKicker: 'Inclusions',
    lineItemsTitle: 'Service Inclusions',
    pricingEyebrow: 'Service Pricing',
    investmentTitle: 'Service Investment',
    detailsSectionTitle: '1. Service Details',
    serviceTypeLabel: 'Service',
    serviceDateLabel: 'Start / Service Date',
    deliveryLocationLabel: 'Service Address',
    paymentTermsTitle: '2. Payment Terms',
    retainerLabel: 'Approval',
    finalBalanceLabel: 'Billing Schedule',
    finalBalanceMode: 'subscription-schedule',
    finalBalanceFallback: 'Per approved billing schedule',
    latePaymentLabel: 'Billing Notes',
    retainerCopy:
      'A signed agreement and any required initial payment are due before lessons, recurring deliveries, or service scheduling begin.',
    latePaymentCopy:
      'Late payment may pause recurring deliveries, delay lesson scheduling, or require service dates to be rescheduled.',
  }),
};

export function isProposalRendererFinalBalanceMode(
  value: unknown
): value is ProposalRendererFinalBalanceMode {
  return typeof value === 'string' && PROPOSAL_RENDERER_FINAL_BALANCE_MODE_SET.has(value);
}

export function getProposalRendererStrategy(
  key: ProposalRendererKey
): ProposalRendererStrategy {
  return PROPOSAL_RENDERER_STRATEGIES[key];
}
