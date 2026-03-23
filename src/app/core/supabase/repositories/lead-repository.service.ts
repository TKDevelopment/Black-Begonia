import { Injectable } from '@angular/core';
import { Lead } from '../../models/lead';
import { SupabaseService } from '../clients/supabase.service';
import { CreateGeneralLeadInput } from '../../models/create-general-lead-input';
import { CreateWeddingLeadInput } from '../../models/create-wedding-lead-input';

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
    reception_venue_name,
    reception_venue_city,
    reception_venue_state,
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
    consultation_scheduled_at
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
      service_type: payload.service_type,
      event_type: 'general',
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || null,
      preferred_contact_method: payload.preferred_contact_method || null,
      event_date: payload.event_date || null,
      inquiry_message: payload.inquiry_message?.trim() || null,
      source: payload.source?.trim() || 'other',
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
      service_type: payload.service_type,
      event_type: 'wedding',
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      partner_first_name: payload.partner_first_name?.trim() || null,
      partner_last_name: payload.partner_last_name?.trim() || null,
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || null,
      preferred_contact_method: payload.preferred_contact_method || null,
      event_date: payload.event_date || null,
      ceremony_venue_name: payload.ceremony_venue_name?.trim() || null,
      ceremony_venue_city: payload.ceremony_venue_city?.trim() || null,
      ceremony_venue_state: payload.ceremony_venue_state?.trim() || null,
      reception_venue_name: payload.reception_venue_name?.trim() || null,
      reception_venue_city: payload.reception_venue_city?.trim() || null,
      reception_venue_state: payload.reception_venue_state?.trim() || null,
      budget_range: payload.budget_range?.trim() || null,
      guest_count:
        payload.guest_count === null ||
        payload.guest_count === undefined ||
        Number.isNaN(payload.guest_count)
          ? null
          : payload.guest_count,
      inquiry_message: payload.inquiry_message?.trim() || null,
      source: payload.source?.trim() || 'other',
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
}