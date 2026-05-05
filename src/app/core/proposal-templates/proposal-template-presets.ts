import { ProposalRendererKey } from './proposal-renderer-registry';
import { ProposalTemplateServiceProfile } from './proposal-template-service-profile';

export type ProposalTemplateStudioLayoutVariant =
  | 'standard'
  | 'highlights'
  | 'agreement-focused';

export interface ProposalTemplateStudioHighlight {
  title: string;
  copy: string;
}

export interface ProposalTemplateStudioPreset {
  layoutVariant: ProposalTemplateStudioLayoutVariant;
  starterTemplateId?: string;
  frontPageNote: string;
  agreementIntro: string;
  bannerMode?: 'customer-service' | 'document-title';
  bannerSubtitle?: string;
  heroCaption: string;
  galleryCaptions: string[];
  highlights?: ProposalTemplateStudioHighlight[];
}

export interface ProposalTemplatePreset {
  rendererKey: ProposalRendererKey;
  label: string;
  description: string;
  serviceProfile: ProposalTemplateServiceProfile;
  studio: ProposalTemplateStudioPreset;
}

const PROPOSAL_TEMPLATE_PRESETS: Partial<Record<ProposalRendererKey, ProposalTemplatePreset>> = {
  memorial: {
    rendererKey: 'memorial',
    label: 'Memorial Tribute',
    description:
      'A quieter agreement profile with sensitive family-facing language and a supportive Studio layout.',
    serviceProfile: {
      documentTitle: 'Memorial Floral Proposal',
      agreementTitle: 'Memorial Floral Services Agreement',
      lineItemsKicker: 'Tribute Plan',
      lineItemsTitle: 'Memorial Floral Selections',
      pricingEyebrow: 'Service Pricing',
      investmentTitle: 'Memorial Investment',
      detailsSectionTitle: '1. Service Details',
      serviceTypeLabel: 'Memorial Service Type',
      serviceDateLabel: 'Service Date',
      deliveryLocationLabel: 'Service Location',
      paymentTermsTitle: '2. Approval & Payment',
      retainerLabel: 'Approval & Deposit',
      finalBalanceLabel: 'Invoice Due',
      finalBalanceMode: 'upon-approval',
      finalBalanceFallback: 'Due upon approval',
      latePaymentLabel: 'Timing Notes',
      retainerCopy:
        'Because memorial work is often arranged on a shorter timeline, written approval and any requested deposit are required before sourcing, design, and delivery coordination begin.\n\nOnce availability is confirmed, Black Begonia will begin preparing the tribute florals outlined in this proposal and coordinate any delivery details with the family or designated point of contact.',
      latePaymentCopy:
        'If approval or payment is delayed, certain blooms or design materials may no longer be available. In that situation, Black Begonia will make substitutions that preserve the tone, palette, and overall floral intention as closely as possible.',
      privacyTitle: 'Family Privacy',
      privacyCopy:
        'Contact information, service details, and memorial notes are used only for proposal preparation, delivery coordination, and fulfillment of the agreed floral services. Sensitive family information is not shared outside of the vendors or locations necessary to complete the work.',
      signatureTitle: 'Service Approval & Signature',
      clientSignatureParty: '{{customer_name}} or family representative',
    },
    studio: {
      layoutVariant: 'highlights',
      starterTemplateId: 'heirloom-parlor',
      bannerMode: 'document-title',
      bannerSubtitle: 'Designed for memorials, celebrations of life, and sympathy work.',
      frontPageNote:
        'Use this layout for sympathy work, memorial services, and celebration-of-life florals. Keep the tone calm, clear, and supportive while letting the renderer handle the service details and family-facing agreement language.',
      agreementIntro:
        'This agreement layout is intended for memorial florals where timing, delivery coordination, and compassionate communication matter. Use the runtime sections below to keep the legal structure consistent while personalizing the visual presentation.',
      heroCaption: 'Featured sympathy arrangement or tribute installation',
      galleryCaptions: [
        'Casket spray, standing spray, or altar design reference',
        'Urn florals, framed tribute, or table arrangement inspiration',
        'Delivery-ready bouquet bundles or sympathy pieces',
        'Color story or bloom palette for a softer service tone',
      ],
      highlights: [
        {
          title: 'Family Coordination',
          copy: 'Use the intro and header space to clarify the service contact, delivery liaison, or designated family representative.',
        },
        {
          title: 'Time-Sensitive Sourcing',
          copy: 'Keep room for substitutions, availability notes, and short approval windows where necessary.',
        },
        {
          title: 'Delivery Clarity',
          copy: 'Memorial work benefits from clean service-date and location language with direct delivery instructions.',
        },
      ],
    },
  },
  'flower-bar': {
    rendererKey: 'flower-bar',
    label: 'Flower Bar Experience',
    description:
      'An interactive event preset focused on guest experience, staffing, and setup logistics.',
    serviceProfile: {
      documentTitle: 'Flower Bar Proposal',
      agreementTitle: 'Flower Bar Services Agreement',
      lineItemsKicker: 'Experience Design',
      lineItemsTitle: 'Flower Bar Inclusions',
      pricingEyebrow: 'Event Pricing',
      investmentTitle: 'Flower Bar Investment',
      detailsSectionTitle: '1. Event Details',
      serviceTypeLabel: 'Experience Type',
      serviceDateLabel: 'Event Date',
      deliveryLocationLabel: 'Setup Location',
      paymentTermsTitle: '4. Payment Terms',
      retainerLabel: 'Reservation Deposit',
      finalBalanceLabel: 'Final Balance Due Date',
      finalBalanceMode: 'event-minus-14',
      finalBalanceFallback: '14 days prior to event',
      latePaymentLabel: 'Late Payments',
      retainerCopy:
        'A signed agreement and reservation deposit are required before flower bar inventory, staffing, rentals, and setup timing are reserved.\n\nOnce booked, Black Begonia will prepare the experience outline, sourcing plan, and installation schedule reflected in this proposal.',
      latePaymentCopy:
        'Late payment may affect bloom sourcing, staffing confirmation, rental timing, or event-day installation windows. If event logistics shift after booking, Black Begonia may update the proposal to reflect the new scope.',
      privacyTitle: 'Event Privacy',
      privacyCopy:
        'Client contact information and event details are used only for proposal preparation, booking communication, staffing coordination, and fulfillment of the flower bar experience. Information is shared only with partners or venues necessary to complete setup and breakdown.',
      signatureTitle: 'Reservation Approval & Signature',
      clientSignatureParty: '{{customer_name}} / event host',
    },
    studio: {
      layoutVariant: 'highlights',
      starterTemplateId: 'romantic-editorial',
      bannerMode: 'customer-service',
      bannerSubtitle: 'Interactive floral styling for guest-facing experiences.',
      frontPageNote:
        'This starter is designed for guest-interactive flower bars. Use the visual side of the page to sell the experience, then let the renderer inject staffing, setup, payment, and logistics language.',
      agreementIntro:
        'This agreement page should support a polished, guest-facing flower bar service with clear setup timing, inventory planning, and event-day expectations. The runtime sections below keep the legal and payment language flexible while preserving the visual brand shell.',
      heroCaption: 'Flower bar hero moment, guest table, or styled activation vignette',
      galleryCaptions: [
        'Stem wall, bloom bucket, or wrap station detail',
        'Guest interaction or favor-building inspiration',
        'Rental, signage, ribbon, or packaging accent ideas',
        'Styled bar palette with color-forward merchandising',
      ],
      highlights: [
        {
          title: 'Guest Experience',
          copy: 'Lead with the interactive moment: what guests build, what they take home, and how the station feels on site.',
        },
        {
          title: 'Inventory & Setup',
          copy: 'Use proposal copy to clarify stem counts, prep assumptions, setup windows, and any rental or styling inclusions.',
        },
        {
          title: 'Staffing Flow',
          copy: 'Highlight whether the bar is styled self-serve, attendant-led, or supported by on-site instruction.',
        },
      ],
    },
  },
  'workshop-private': {
    rendererKey: 'workshop-private',
    label: 'Private Workshop Host',
    description:
      'A hosted education preset built for instruction, materials, and participant-ready layout planning.',
    serviceProfile: {
      documentTitle: 'Workshop Proposal',
      agreementTitle: 'Private Floral Workshop Agreement',
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
        'A signed agreement and reservation deposit are required before instruction time, participant materials, and workshop scheduling are confirmed.\n\nOnce reserved, Black Begonia will prepare the workshop format, floral recipes, and supply plan reflected in this proposal.',
      latePaymentCopy:
        'Late payment may affect material sourcing, guest counts, workshop scheduling, or participant preparation. Changes to the workshop scope after booking may require an updated proposal or revised sourcing plan.',
      privacyTitle: 'Workshop Privacy',
      privacyCopy:
        'Contact details and workshop information are used only for proposal preparation, booking communication, instructional planning, and fulfillment of the agreed workshop services. Information is not shared outside the vendors or locations needed to host the workshop.',
      signatureTitle: 'Workshop Approval & Signature',
      clientSignatureParty: '{{customer_name}} / workshop host',
    },
    studio: {
      layoutVariant: 'highlights',
      starterTemplateId: 'modern-botanical',
      bannerMode: 'customer-service',
      bannerSubtitle: 'Hosted floral instruction for private groups and events.',
      frontPageNote:
        'Use this starter for project-based workshops that still live in your CRM project lifecycle. The layout is meant to sell the hosted experience while the renderer handles the agreement language, workshop timing, and payment details.',
      agreementIntro:
        'This workshop agreement space is built for hosted instruction, group floral experiences, and material planning. Use the runtime sections below to keep your legal structure consistent while styling each workshop offering differently.',
      heroCaption: 'Workshop host table, instruction setup, or participant-facing floral moment',
      galleryCaptions: [
        'Participant place setting or individual stem recipe reference',
        'Instructor demo arrangement or centerpiece sample',
        'Tool kit, wrapped materials, or class supply vignette',
        'Group table styling, signage, or experiential floral detail',
      ],
      highlights: [
        {
          title: 'Instruction Format',
          copy: 'Clarify whether the workshop is demonstration-led, guided hands-on, or a hosted drop-in activity.',
        },
        {
          title: 'Materials & Tools',
          copy: 'Use the investment and line-item areas to show what each participant receives and what the host is reserving.',
        },
        {
          title: 'Guest Readiness',
          copy: 'Keep space for setup windows, seating assumptions, and any host-provided tables, linens, or utilities.',
        },
      ],
    },
  },
  'basic-agreement': {
    rendererKey: 'basic-agreement',
    label: 'Service Agreement',
    description:
      'A compact agreement-first preset for recurring or lightweight services that do not need a full proposal presentation.',
    serviceProfile: {
      documentTitle: 'Floral Service Agreement',
      agreementTitle: 'Floral Service Agreement',
      lineItemsKicker: 'Service Scope',
      lineItemsTitle: 'Service Inclusions',
      pricingEyebrow: 'Service Pricing',
      investmentTitle: 'Service Investment',
      detailsSectionTitle: '1. Service Overview',
      serviceTypeLabel: 'Service Type',
      serviceDateLabel: 'Start / Service Date',
      deliveryLocationLabel: 'Service Address',
      paymentTermsTitle: '2. Billing & Scheduling',
      retainerLabel: 'Initial Approval',
      finalBalanceLabel: 'Billing Schedule',
      finalBalanceMode: 'subscription-schedule',
      finalBalanceFallback: 'Per approved billing schedule',
      latePaymentLabel: 'Service Interruptions',
      retainerCopy:
        'A signed agreement and any required initial payment are due before service scheduling, lesson planning, or recurring floral fulfillment begin.\n\nOnce approved, Black Begonia will begin the service cadence, scheduling, or preparation outlined in this agreement.',
      latePaymentCopy:
        'Late payment may pause recurring deliveries, delay lesson scheduling, or require upcoming service dates to be rescheduled until the account is brought current.',
      privacyTitle: 'Client Privacy',
      privacyCopy:
        'Contact information, delivery details, and service notes are used only for scheduling, billing, communication, and fulfillment of the agreed floral services. Information is not sold or shared outside the partners required to complete the service.',
      signatureTitle: 'Agreement Approval & Signature',
      clientSignatureParty: '{{customer_name}}',
    },
    studio: {
      layoutVariant: 'agreement-focused',
      starterTemplateId: 'heirloom-parlor',
      bannerMode: 'document-title',
      bannerSubtitle: 'Designed for ongoing services, lessons, and simplified agreements.',
      frontPageNote:
        'Use this compact agreement-first layout for services that do not need a large editorial proposal. It keeps the visual shell polished while emphasizing service scope, billing cadence, and signed approval.',
      agreementIntro:
        'This service agreement layout is intentionally more compact than the full proposal experience. It is designed for subscription-style services, lesson scheduling, or other engagements where the agreement matters more than a full event proposal presentation.',
      heroCaption: 'Service overview or product styling image',
      galleryCaptions: [
        'Service detail or delivery-ready floral styling',
        'Packaging, vessel, or recurring arrangement reference',
        'Scheduling or lesson-prep inspiration',
        'Brand styling detail for a lighter agreement shell',
      ],
      highlights: [
        {
          title: 'Billing Rhythm',
          copy: 'Let the front page establish whether the agreement follows a recurring cadence, a lesson schedule, or a one-time service window.',
        },
        {
          title: 'Scope Clarity',
          copy: 'Use the service inclusions area to show exactly what is covered without turning the document into a full event proposal.',
        },
      ],
    },
  },
};

export function getProposalTemplatePreset(
  rendererKey: ProposalRendererKey
): ProposalTemplatePreset | null {
  return PROPOSAL_TEMPLATE_PRESETS[rendererKey] ?? null;
}

export function getProposalTemplateServiceProfilePreset(
  rendererKey: ProposalRendererKey
): ProposalTemplateServiceProfile {
  return {
    ...(PROPOSAL_TEMPLATE_PRESETS[rendererKey]?.serviceProfile ?? {}),
  };
}

export function getProposalTemplateStudioPreset(
  rendererKey: ProposalRendererKey
): ProposalTemplateStudioPreset | null {
  const preset = PROPOSAL_TEMPLATE_PRESETS[rendererKey];

  if (!preset) {
    return null;
  }

  return {
    ...preset.studio,
    galleryCaptions: [...preset.studio.galleryCaptions],
    highlights: preset.studio.highlights?.map((highlight) => ({ ...highlight })),
  };
}
