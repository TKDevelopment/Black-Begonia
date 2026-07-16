import { Injectable } from '@angular/core';
import { Lead } from '../../models/lead';
import { SupabaseService } from '../clients/supabase.service';
import { CreateGeneralLeadInput } from '../../models/create-general-lead-input';
import { CreateWeddingLeadInput } from '../../models/create-wedding-lead-input';
import {
  normalizeFloralServiceEventType,
  resolveFloralServiceDatabaseValue,
} from '../../floral-services/floral-service-catalog';
import { normalizeDateOnly } from '../../utils/date-only';

type SupabaseLeadSource =
  | 'instagram'
  | 'facebook'
  | 'google'
  | 'pinterest'
  | 'the knot'
  | 'wedding wire'
  | 'yelp'
  | 'venue partner'
  | 'bridal show'
  | 'other'
  | 'website';

const SUPABASE_LEAD_SOURCES: readonly SupabaseLeadSource[] = [
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
];

const LEAD_SOURCE_ALIASES = new Map<string, SupabaseLeadSource>([
  ['personal referral', 'other'],
  ['referral', 'other'],
  ['crm', 'other'],
]);

@Injectable({
  providedIn: 'root',
})
export class LeadRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly leadSelect = `
    lead_id,
    service_type,
    event_type,
    first_name,
    last_name,
    partner_first_name,
    partner_last_name,
    email,
    phone,
    preferred_contact_method,
    event_date,
    ceremony_venue_name,
    ceremony_venue_city,
    ceremony_venue_state,
    ceremony_start_time,
    reception_venue_name,
    reception_venue_city,
    reception_venue_state,
    reception_start_time,
    event_start_time,
    budget_range,
    guest_count,
    inquiry_message,
    source,
    status,
    assigned_user_id,
    decline_reason,
    converted_project_id,
    converted_primary_contact_id,
    converted_at,
    declined_at,
    last_contacted_at,
    created_at,
    updated_at,
    consultation_completed_at,
    consultation_scheduled_at,
    planner_name,
    planner_phone,
    planner_email
  `;

  async getLeads(): Promise<Lead[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('leads')
      .select(this.leadSelect)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[LeadRepositoryService] getLeads error:', error);
      return [];
    }

    return (data ?? []) as Lead[];
  }

  async getLeadById(leadId: string): Promise<Lead | null> {
    const { data, error } = await this.supabaseService.getClient()
      .from('leads')
      .select(this.leadSelect)
      .eq('lead_id', leadId)
      .single();

    if (error) {
      console.error('[LeadRepositoryService] getLeadById error:', error);
      return null;
    }

    return data as Lead;
  }

  async createGeneralLead(payload: CreateGeneralLeadInput): Promise<Lead> {
    const normalizedPayload = {
      service_type: this.normalizeServiceType(payload.service_type, 'general'),
      event_type: 'general',
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || null,
      preferred_contact_method: payload.preferred_contact_method || null,
      event_date: normalizeDateOnly(payload.event_date),
      inquiry_message: payload.inquiry_message?.trim() || null,
      source: this.normalizeLeadSource(payload.source),
    };

    const { data, error } = await this.supabaseService
      .getClient()
      .from('leads')
      .insert(normalizedPayload)
      .select(this.leadSelect)
      .single();

    if (error) {
      console.error('[LeadRepositoryService] createGeneralLead error:', error);
      throw error;
    }

    return data as Lead;
  }

  async createWeddingLead(payload: CreateWeddingLeadInput): Promise<Lead> {
    const normalizedPayload = {
      service_type: this.normalizeServiceType(payload.service_type, 'wedding'),
      event_type: 'wedding',
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      partner_first_name: payload.partner_first_name?.trim() || null,
      partner_last_name: payload.partner_last_name?.trim() || null,
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || null,
      preferred_contact_method: payload.preferred_contact_method || null,
      event_date: normalizeDateOnly(payload.event_date),
      ceremony_venue_name: payload.ceremony_venue_name?.trim() || null,
      ceremony_venue_city: payload.ceremony_venue_city?.trim() || null,
      ceremony_venue_state: payload.ceremony_venue_state?.trim() || null,
      ceremony_start_time: payload.ceremony_start_time || null,
      reception_venue_name: payload.reception_venue_name?.trim() || null,
      reception_venue_city: payload.reception_venue_city?.trim() || null,
      reception_venue_state: payload.reception_venue_state?.trim() || null,
      reception_start_time: payload.reception_start_time || null,
      event_start_time: payload.event_start_time || null,
      budget_range: payload.budget_range?.trim() || null,
      guest_count:
        payload.guest_count === null ||
        payload.guest_count === undefined ||
        Number.isNaN(payload.guest_count)
          ? null
          : payload.guest_count,
      inquiry_message: payload.inquiry_message?.trim() || null,
      planner_name: payload.planner_name?.trim() || null,
      planner_phone: payload.planner_phone?.trim() || null,
      planner_email: payload.planner_email?.trim() || null,
      source: this.normalizeLeadSource(payload.source),
    };

    const { data, error } = await this.supabaseService
      .getClient()
      .from('leads')
      .insert(normalizedPayload)
      .select(this.leadSelect)
      .single();

    if (error) {
      console.error('[LeadRepositoryService] createWeddingLead error:', error);
      throw error;
    }

    return data as Lead;
  }

  async updateLead(
    leadId: string,
    updates: Partial<Lead>
  ): Promise<Lead> {
    const payload = {
      ...updates,
      ...(updates.service_type !== undefined
        ? {
            service_type: this.normalizeServiceType(
              updates.service_type,
              updates.event_type
            ),
          }
        : {}),
      ...(updates.source !== undefined
        ? { source: this.normalizeLeadSource(updates.source) }
        : {}),
      ...(updates.event_date !== undefined
        ? { event_date: normalizeDateOnly(updates.event_date) }
        : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabaseService
      .getClient()
      .from('leads')
      .update(payload)
      .eq('lead_id', leadId)
      .select(this.leadSelect)
      .single();

    if (error) {
      console.error('[LeadRepositoryService] updateLead error:', error);
      throw error;
    }

    return data as Lead;
  }

  private normalizeServiceType(
    serviceType: string,
    eventType?: string | null
  ): string {
    return (
      resolveFloralServiceDatabaseValue(
        serviceType,
        normalizeFloralServiceEventType(eventType)
      ) ?? serviceType.trim()
    );
  }

  private normalizeLeadSource(source: string | null | undefined): SupabaseLeadSource {
    const normalized = this.normalizeEnumInput(source);

    if (!normalized) {
      return 'other';
    }

    const directSource = SUPABASE_LEAD_SOURCES.find(
      (leadSource) => this.normalizeEnumInput(leadSource) === normalized
    );

    return directSource ?? LEAD_SOURCE_ALIASES.get(normalized) ?? 'other';
  }

  private normalizeEnumInput(value: string | null | undefined): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async deleteLead(leadId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('leads')
      .delete()
      .eq('lead_id', leadId);

    if (error) {
      console.error('[LeadRepositoryService] deleteLead error:', error);
      throw error;
    }
  }
}
