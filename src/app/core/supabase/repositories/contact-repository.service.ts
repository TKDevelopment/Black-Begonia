import { Injectable } from '@angular/core';
import { Contact, CreateContactInput } from '../../models/contact';
import { SupabaseService } from '../clients/supabase.service';
import { Project } from '../../models/project';

@Injectable({
  providedIn: 'root',
})
export class ContactRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly contactSelect = `
    contact_id,
    first_name,
    last_name,
    email,
    phone,
    secondary_phone,
    preferred_contact_method,
    address_line_1,
    address_line_2,
    city,
    state,
    postal_code,
    country,
    contact_type,
    notes,
    created_from_lead_id,
    is_archived,
    archived_at,
    created_at,
    updated_at
  `;

  async getContacts(): Promise<Contact[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('contacts')
      .select(this.contactSelect)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (error) {
      console.error('[ContactRepositoryService] getContacts error:', error);
      return [];
    }

    return (data ?? []) as Contact[];
  }

  async getContactById(contactId: string): Promise<Contact | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('contacts')
      .select(this.contactSelect)
      .eq('contact_id', contactId)
      .single();

    if (error) {
      console.error('[ContactRepositoryService] getContactById error:', error);
      return null;
    }

    return data as Contact;
  }

  async createContact(payload: CreateContactInput): Promise<Contact> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('contacts')
      .insert({
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        email: payload.email?.trim().toLowerCase() || null,
        phone: payload.phone?.trim() || null,
        secondary_phone: payload.secondary_phone?.trim() || null,
        preferred_contact_method: payload.preferred_contact_method || null,
        address_line_1: payload.address_line_1?.trim() || null,
        address_line_2: payload.address_line_2?.trim() || null,
        city: payload.city?.trim() || null,
        state: payload.state?.trim() || null,
        postal_code: payload.postal_code?.trim() || null,
        country: payload.country?.trim() || 'US',
        contact_type: payload.contact_type || undefined,
        notes: payload.notes?.trim() || null,
        created_from_lead_id: payload.created_from_lead_id ?? null,
      })
      .select(this.contactSelect)
      .single();

    if (error) {
      console.error('[ContactRepositoryService] createContact error:', error);
      throw error;
    }

    return data as Contact;
  }

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<Contact> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('contacts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('contact_id', contactId)
      .select(this.contactSelect)
      .single();

    if (error) {
      console.error('[ContactRepositoryService] updateContact error:', error);
      throw error;
    }

    return data as Contact;
  }

  async getRelatedProjects(contactId: string): Promise<Project[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_contacts')
      .select(`
        project:projects (
          project_id,
          project_name,
          service_type,
          event_type,
          event_date,
          ceremony_venue_name,
          ceremony_venue_city,
          ceremony_venue_state,
          ceremony_venue_address,
          reception_venue_name,
          reception_venue_city,
          reception_venue_state,
          reception_venue_address,
          budget_range,
          guest_count,
          style_notes,
          internal_notes,
          status,
          source_lead_id,
          primary_contact_id,
          assigned_user_id,
          booked_at,
          completed_at,
          canceled_at,
          created_at,
          updated_at
        )
      `)
      .eq('contact_id', contactId);

    if (error) {
      console.error('[ContactRepositoryService] getRelatedProjects error:', error);
      return [];
    }

    return (data ?? []).map((row: any) => row.project).filter((project: Project | null) => !!project);
  }
}
