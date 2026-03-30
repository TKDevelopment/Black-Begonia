import { Injectable } from '@angular/core';
import { CreateOrganizationInput, Organization } from '../../models/organization';
import { SupabaseService } from '../clients/supabase.service';
import { Project } from '../../models/project';

@Injectable({
  providedIn: 'root',
})
export class OrganizationRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly organizationSelect = `
    organization_id,
    name,
    organization_type,
    email,
    phone,
    website,
    address_line_1,
    address_line_2,
    city,
    state,
    postal_code,
    country,
    notes,
    created_from_lead_id,
    is_archived,
    archived_at,
    created_at,
    updated_at
  `;

  private readonly projectSelect = `
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
  `;

  async getOrganizations(): Promise<Organization[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('organizations')
      .select(this.organizationSelect)
      .order('name', { ascending: true });

    if (error) {
      console.error('[OrganizationRepositoryService] getOrganizations error:', error);
      return [];
    }

    return (data ?? []) as Organization[];
  }

  async getOrganizationById(organizationId: string): Promise<Organization | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('organizations')
      .select(this.organizationSelect)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      console.error('[OrganizationRepositoryService] getOrganizationById error:', error);
      return null;
    }

    return data as Organization;
  }

  async createOrganization(payload: CreateOrganizationInput): Promise<Organization> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('organizations')
      .insert({
        name: payload.name.trim(),
        organization_type: payload.organization_type,
        email: payload.email?.trim().toLowerCase() || null,
        phone: payload.phone?.trim() || null,
        website: payload.website?.trim() || null,
        address_line_1: payload.address_line_1?.trim() || null,
        address_line_2: payload.address_line_2?.trim() || null,
        city: payload.city?.trim() || null,
        state: payload.state?.trim() || null,
        postal_code: payload.postal_code?.trim() || null,
        country: payload.country?.trim() || 'US',
        notes: payload.notes?.trim() || null,
        created_from_lead_id: payload.created_from_lead_id ?? null,
      })
      .select(this.organizationSelect)
      .single();

    if (error) {
      console.error('[OrganizationRepositoryService] createOrganization error:', error);
      throw error;
    }

    return data as Organization;
  }

  async updateOrganization(organizationId: string, updates: Partial<Organization>): Promise<Organization> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('organizations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .select(this.organizationSelect)
      .single();

    if (error) {
      console.error('[OrganizationRepositoryService] updateOrganization error:', error);
      throw error;
    }

    return data as Organization;
  }

  async getRelatedProjects(organizationId: string): Promise<Project[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_organizations')
      .select(`project:projects (${this.projectSelect})`)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('[OrganizationRepositoryService] getRelatedProjects error:', error);
      return [];
    }

    return (data ?? []).map((row: any) => row.project).filter((project: Project | null) => !!project);
  }
}
