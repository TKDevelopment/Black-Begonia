import { AuthState } from '../auth/auth.models';
import { ActivityLogEntry } from '../models/activity-log';
import { CatalogItem } from '../models/catalog-item';
import { Contact } from '../models/contact';
import { Lead } from '../models/lead';
import { LeadActivity } from '../models/lead-activity';
import { LeadInspirationUrl } from '../models/lead-inspiration-url';
import { Organization } from '../models/organization';
import {
  DocumentTemplate,
  FloralProposalComponent,
  FloralProposal,
  FloralProposalLineItem,
  FloralProposalRenderContract,
  FloralProposalShoppingListItem,
} from '../models/floral-proposal';
import { Project } from '../models/project';
import type { ProjectPaymentRecord } from '../models/project-payment-record';
import { TaxRegion } from '../models/tax-region';
import { Task } from '../models/task';

const now = '2026-06-02T12:00:00.000Z';

export const testLead: Lead = {
  lead_id: 'lead-test-001',
  service_type: 'wedding',
  event_type: 'wedding',
  first_name: 'Avery',
  last_name: 'Bloom',
  partner_first_name: 'Jordan',
  partner_last_name: 'Reed',
  email: 'avery.bloom@example.test',
  phone: '555-0100',
  preferred_contact_method: 'email',
  event_date: '2026-10-24',
  ceremony_venue_name: 'Test Garden',
  ceremony_venue_city: 'Austin',
  ceremony_venue_state: 'TX',
  ceremony_venue_address: '100 Garden Way',
  ceremony_venue_zipcode: '78701',
  reception_venue_name: 'Test Hall',
  reception_venue_city: 'Austin',
  reception_venue_state: 'TX',
  reception_venue_address: '200 Hall Road',
  reception_venue_zipcode: '78702',
  ceremony_start_time: '16:00',
  reception_start_time: '18:00',
  event_start_time: '16:00',
  budget_range: '$5,000-$7,500',
  guest_count: 80,
  inquiry_message: 'Synthetic inquiry fixture for unit tests.',
  source: 'website',
  status: 'new',
  assigned_user_id: null,
  decline_reason: null,
  converted_project_id: null,
  converted_primary_contact_id: null,
  converted_at: null,
  declined_at: null,
  last_contacted_at: null,
  created_at: now,
  updated_at: now,
  consultation_scheduled_at: null,
  consultation_completed_at: null,
  planner_name: null,
  planner_phone: null,
  planner_email: null,
};

export const testWeddingLead: Lead = {
  ...testLead,
  lead_id: 'lead-wedding-001',
  service_type: 'Full-Service Wedding',
  event_type: 'wedding',
  status: 'new',
};

export const testGeneralLead: Lead = {
  ...testLead,
  lead_id: 'lead-general-001',
  service_type: 'Corporate Events',
  event_type: 'general',
  first_name: 'Morgan',
  last_name: 'Petal',
  partner_first_name: null,
  partner_last_name: null,
  email: 'morgan.petal@example.test',
  event_date: '2026-09-12',
  ceremony_venue_name: null,
  ceremony_venue_city: null,
  ceremony_venue_state: null,
  ceremony_venue_address: null,
  ceremony_venue_zipcode: null,
  ceremony_start_time: null,
  reception_venue_name: null,
  reception_venue_city: null,
  reception_venue_state: null,
  reception_venue_address: null,
  reception_venue_zipcode: null,
  reception_start_time: null,
  event_start_time: null,
  budget_range: null,
  guest_count: null,
  status: 'new',
};

export const testProposalAcceptedLead: Lead = {
  ...testWeddingLead,
  lead_id: 'lead-proposal-accepted-001',
  status: 'proposal_accepted',
};

export const testConvertedLead: Lead = {
  ...testWeddingLead,
  lead_id: 'lead-converted-001',
  status: 'converted',
  converted_project_id: 'project-test-001',
  converted_primary_contact_id: 'contact-test-001',
  converted_at: now,
};

export const testGeneralInquiry = {
  first_name: 'Morgan',
  last_name: 'Petal',
  email: 'morgan.petal@example.test',
  phone: '555-0101',
  service_type: 'general',
  event_type: 'celebration',
  event_date: '2026-09-12',
  message: 'Synthetic general inquiry fixture.',
};

export const testWeddingInquiry = {
  ...testGeneralInquiry,
  first_name: 'Avery',
  last_name: 'Bloom',
  partner_first_name: 'Jordan',
  partner_last_name: 'Reed',
  service_type: 'wedding',
  guest_count: 80,
  ceremony_venue_name: 'Test Garden',
  reception_venue_name: 'Test Hall',
};

export const testGeneralLeadUpsertPayload = {
  event_type: 'general',
  service_type: 'Corporate Events',
  first_name: 'Morgan',
  last_name: 'Petal',
  email: 'morgan.petal@example.test',
  phone: '555-0101',
  preferred_contact_method: 'email',
  event_date: '2026-09-12',
  inquiry_message: 'Synthetic general lead payload.',
  source: 'crm',
};

export const testWeddingLeadUpsertPayload = {
  event_type: 'wedding',
  service_type: 'Full-Service Wedding',
  first_name: 'Avery',
  last_name: 'Bloom',
  partner_first_name: 'Jordan',
  partner_last_name: 'Reed',
  planner_name: 'Casey Planner',
  planner_phone: '555-0199',
  planner_email: 'casey.planner@example.test',
  email: 'avery.bloom@example.test',
  phone: '555-0100',
  preferred_contact_method: 'email',
  event_date: '2026-10-24',
  ceremony_venue_name: 'Test Garden',
  ceremony_venue_city: 'Austin',
  ceremony_venue_state: 'TX',
  ceremony_start_time: '16:00',
  reception_venue_name: 'Test Hall',
  reception_venue_city: 'Austin',
  reception_venue_state: 'TX',
  reception_start_time: '18:00',
  budget_range: '$5,000-$7,500',
  guest_count: 80,
  inquiry_message: 'Synthetic wedding lead payload.',
  source: 'crm',
};

export const testProposalResponseActivity: LeadActivity = {
  lead_activity_id: 'activity-proposal-response-001',
  lead_id: testLead.lead_id,
  activity_type: 'proposal_viewed',
  activity_label: 'Proposal response',
  activity_description: 'Client accepted the proposal.',
  performed_by: null,
  metadata: {
    floral_proposal_id: 'proposal-test-001',
    response_action: 'accept',
    feedback: 'Looks perfect.',
  },
  created_at: now,
};

export const testLeadInspirationUrl: LeadInspirationUrl = {
  lead_inspiration_url_id: 'inspiration-test-001',
  lead_id: testLead.lead_id,
  url: 'https://example.test/storage/v1/object/public/lead-inspiration-photos/lead-test-001/photo-one.jpg',
  created_at: now,
};

export const testDocumentTemplate: DocumentTemplate = {
  template_id: 'template-test-001',
  name: 'Test Proposal Template',
  template_key: 'test-proposal-template',
  template_kind: 'floral_proposal',
  is_active: true,
  is_default: true,
  logo_storage_path: 'proposal-template-assets/logo.png',
  logo_url: 'https://example.test/logo.png',
  template_config: {
    renderer_key: 'wedding-full-service',
    service_profile: {
      service_type: 'wedding',
    },
  },
  created_at: now,
  updated_at: now,
};

export const testTaxRegion: TaxRegion = {
  tax_region_id: 'tax-region-test-001',
  name: 'Austin Test Tax',
  authority_name: 'Test Authority',
  tax_rate: 0.0825,
  applies_to_products: true,
  applies_to_services: true,
  applies_to_delivery: true,
  is_active: true,
  created_at: now,
  updated_at: now,
};

export const testCatalogItem: CatalogItem = {
  item_id: 'catalog-rose-001',
  name: 'Garden Rose',
  item_type: 'flower',
  unit_type: 'bunch',
  pack_quantity: 10,
  color: 'Blush',
  variety: 'Juliet',
  sku: 'ROSE-JULIET',
  base_unit_cost: 30,
  default_waste_percent: 10,
  is_active: true,
  created_at: now,
  updated_at: now,
};

export const testContact: Contact = {
  contact_id: 'contact-test-001',
  first_name: 'Rowan',
  last_name: 'Client',
  email: 'rowan.client@example.test',
  phone: '555-0110',
  secondary_phone: null,
  preferred_contact_method: 'email',
  address_line_1: '100 Test Lane',
  address_line_2: null,
  city: 'Austin',
  state: 'TX',
  postal_code: '78701',
  country: 'US',
  contact_type: 'client',
  notes: 'Synthetic contact fixture.',
  created_from_lead_id: testLead.lead_id,
  is_archived: false,
  archived_at: null,
  created_at: now,
  updated_at: now,
};

export const testOrganization: Organization = {
  organization_id: 'organization-test-001',
  name: 'Test Venue Collective',
  organization_type: 'venue',
  email: 'events@example.test',
  phone: '555-0120',
  website: 'https://venue.example.test',
  address_line_1: '200 Fixture Street',
  address_line_2: null,
  city: 'Austin',
  state: 'TX',
  postal_code: '78702',
  country: 'US',
  notes: 'Synthetic organization fixture.',
  created_from_lead_id: testLead.lead_id,
  is_archived: false,
  archived_at: null,
  created_at: now,
  updated_at: now,
};

export const testProject: Project = {
  project_id: 'project-test-001',
  project_name: 'Avery and Jordan Wedding',
  service_type: 'wedding',
  event_type: 'wedding',
  event_date: testLead.event_date,
  ceremony_venue_name: testLead.ceremony_venue_name,
  ceremony_venue_city: testLead.ceremony_venue_city,
  ceremony_venue_state: testLead.ceremony_venue_state,
  ceremony_venue_address: testLead.ceremony_venue_address,
  ceremony_venue_zipcode: testLead.ceremony_venue_zipcode,
  reception_venue_name: testLead.reception_venue_name,
  reception_venue_city: testLead.reception_venue_city,
  reception_venue_state: testLead.reception_venue_state,
  reception_venue_address: testLead.reception_venue_address,
  reception_venue_zipcode: testLead.reception_venue_zipcode,
  budget_range: testLead.budget_range,
  guest_count: testLead.guest_count,
  style_notes: 'Soft garden style.',
  internal_notes: 'Synthetic project fixture.',
  status: 'awaiting_deposit',
  source_lead_id: testLead.lead_id,
  primary_contact_id: testContact.contact_id,
  active_proposal_invoice_snapshot_id: null,
  active_proposal_document_version_id: null,
  assigned_user_id: 'user-test-001',
  booked_at: null,
  completed_at: null,
  canceled_at: null,
  created_at: now,
  updated_at: now,
};

export const testTask: Task = {
  task_id: 'task-test-001',
  title: 'Send proposal follow-up',
  description: 'Synthetic task fixture.',
  related_entity_type: 'lead',
  related_entity_id: testLead.lead_id,
  lead_id: testLead.lead_id,
  project_id: testProject.project_id,
  assigned_user_id: 'user-test-001',
  created_by: 'user-test-001',
  priority: 'high',
  status: 'open',
  due_at: '2026-06-05T12:00:00.000Z',
  completed_at: null,
  created_at: now,
  updated_at: now,
  assigned_user: {
    id: 'user-test-001',
    email: 'admin@example.test',
    first_name: 'Test',
    last_name: 'Admin',
  },
  created_by_user: {
    id: 'user-test-001',
    email: 'admin@example.test',
    first_name: 'Test',
    last_name: 'Admin',
  },
  lead_name: 'Avery Bloom',
};

export const testActivityLogEntry: ActivityLogEntry = {
  activity_log_id: 'activity-log-test-001',
  entity_type: 'lead',
  entity_id: testLead.lead_id,
  activity_type: 'created',
  activity_label: 'Lead created',
  description: 'Synthetic activity log fixture.',
  performed_by: 'user-test-001',
  metadata: { source: 'unit-test' },
  created_at: now,
};

export const testFloralProposal: FloralProposal = {
  floral_proposal_id: 'proposal-test-001',
  lead_id: testLead.lead_id,
  template_id: null,
  tax_region_id: testTaxRegion.tax_region_id,
  version: 1,
  is_active: true,
  status: 'draft',
  customer_email: testLead.email,
  subtotal: 1000,
  tax_rate: 0.0825,
  tax_amount: 82.5,
  total_amount: 1082.5,
  terms_version: 'test-terms',
  privacy_policy_version: 'test-privacy',
  finalized_at: null,
  edit_reopened_at: null,
  submitted_at: null,
  snapshot: {},
  created_by: 'user-test-001',
  created_at: now,
  updated_at: now,
  template: null,
};

export const testProposalLineItem: FloralProposalLineItem = {
  floral_proposal_line_item_id: 'line-test-001',
  floral_proposal_id: testFloralProposal.floral_proposal_id,
  display_order: 1,
  line_item_type: 'product',
  item_name: 'Garden Arrangement',
  quantity: 2,
  unit_price: 250,
  subtotal: 500,
  image_storage_path: null,
  image_alt_text: null,
  image_caption: null,
  snapshot: {},
  created_at: now,
  updated_at: now,
};

export const testProposalComponent: FloralProposalComponent = {
  floral_proposal_component_id: 'component-test-001',
  floral_proposal_line_item_id: testProposalLineItem.floral_proposal_line_item_id,
  display_order: 0,
  catalog_item_id: testCatalogItem.item_id,
  catalog_item_name: testCatalogItem.name,
  quantity_per_unit: 5,
  extended_quantity: 10,
  base_unit_cost: 3,
  applied_markup_percent: 50,
  sell_unit_price: 4.5,
  subtotal: 45,
  reserve_percent: 10,
  snapshot: {
    pack_quantity: testCatalogItem.pack_quantity,
    purchase_unit_cost: testCatalogItem.base_unit_cost,
    item_type: testCatalogItem.item_type,
    unit_type: testCatalogItem.unit_type,
    color: testCatalogItem.color,
    variety: testCatalogItem.variety,
  },
  created_at: now,
  updated_at: now,
};

export const testProposalShoppingListItem: FloralProposalShoppingListItem = {
  floral_proposal_shopping_list_item_id: 'shopping-item-test-001',
  floral_proposal_shopping_list_id: 'shopping-list-test-001',
  catalog_item_id: testCatalogItem.item_id,
  item_name: testCatalogItem.name,
  item_type: testCatalogItem.item_type,
  unit_type: testCatalogItem.unit_type,
  required_units: 10,
  reserve_percent: 10,
  total_plus_reserve: 11,
  reserve_units: 1,
  total_units_to_buy: 20,
  units_per_pack: testCatalogItem.pack_quantity,
  required_pack_count: 2,
  estimated_pack_cost: testCatalogItem.base_unit_cost,
  total_estimated_cost: 60,
  notes: 'Buy in packs of 10.',
};

export const testAuthState: AuthState = {
  initialized: true,
  loading: false,
  session: null,
  user: null,
  profile: {
    id: 'user-test-001',
    email: 'admin@example.test',
    first_name: 'Test',
    last_name: 'Admin',
    display_name: 'Test Admin',
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  roles: ['admin'],
  isInternalUser: true,
};

export const testRenderContract: FloralProposalRenderContract = {
  proposal_id: testFloralProposal.floral_proposal_id,
  proposal_version: 1,
  generated_at: now,
  lead: {
    lead_id: testLead.lead_id,
    first_name: testLead.first_name,
    last_name: testLead.last_name,
    partner_first_name: testLead.partner_first_name,
    partner_last_name: testLead.partner_last_name,
    email: testLead.email,
    phone: testLead.phone,
    service_type: testLead.service_type,
    event_type: testLead.event_type,
    event_date: testLead.event_date,
    status: testLead.status,
  },
  template: {
    template_id: testDocumentTemplate.template_id,
    name: testDocumentTemplate.name,
    template_key: testDocumentTemplate.template_key,
    renderer_key: 'wedding-full-service',
  },
  tax_region: {
    tax_region_id: testTaxRegion.tax_region_id,
    name: testTaxRegion.name,
    tax_rate: testTaxRegion.tax_rate,
  },
  pricing: {
    default_markup_percent: 30,
    labor_percent: 20,
  },
  line_items: [
    {
      display_order: testProposalLineItem.display_order,
      line_item_type: testProposalLineItem.line_item_type,
      line_type_label: 'Product',
      item_name: testProposalLineItem.item_name,
      description: null,
      quantity: testProposalLineItem.quantity,
      unit_price: testProposalLineItem.unit_price,
      subtotal: testProposalLineItem.subtotal,
      image_storage_path: testProposalLineItem.image_storage_path,
      image_signed_url: null,
      image_alt_text: testProposalLineItem.image_alt_text,
      image_caption: testProposalLineItem.image_caption,
      components: [
        {
          display_order: testProposalComponent.display_order,
          catalog_item_id: testProposalComponent.catalog_item_id,
          catalog_item_name: testProposalComponent.catalog_item_name,
          quantity_per_unit: testProposalComponent.quantity_per_unit,
          extended_quantity: testProposalComponent.extended_quantity,
          base_unit_cost: testProposalComponent.base_unit_cost,
          applied_markup_percent: testProposalComponent.applied_markup_percent,
          sell_unit_price: testProposalComponent.sell_unit_price,
          subtotal: testProposalComponent.subtotal,
          reserve_percent: testProposalComponent.reserve_percent,
          snapshot: testProposalComponent.snapshot,
        },
      ],
    },
  ],
  shopping_list: [testProposalShoppingListItem],
  totals: {
    products_total: 1000,
    labor_total: 200,
    fees_total: 0,
    discounts_total: 0,
    subtotal: 1200,
    tax_amount: 99,
    total_amount: 1299,
  },
  renderer_assets: {
    line_item_images: [],
  },
};


export const LEGACY_PAYMENT_WORKFLOW_FIXTURE = {
  conversion: { leadStatus: 'proposal_accepted', projectStatus: 'awaiting_deposit', createsPrimaryContact: true },
  manualPayment: { depositMethod: 'venmo', finalMethod: 'check' },
  legacyFinalCollectionDays: 45,
  proposalRevisionPreservesActiveSnapshot: true,
  projectRoute: '/admin/projects/project-fixture',
} as const;

export const LEGACY_PAYMENT_RECORDS: ProjectPaymentRecord[] = [{
  project_payment_record_id: '00000000-0000-4000-8000-000000000101',
  project_id: '00000000-0000-4000-8000-000000000001',
  payment_kind: 'deposit', status: 'paid', amount_due: 300, amount_paid: 300,
  due_date: '2026-01-01', paid_date: '2026-01-01T15:00:00Z', payment_method: 'venmo',
  payment_source: 'manual', created_at: '2026-01-01T15:00:00Z', updated_at: '2026-01-01T15:00:00Z',
}];
