import { Injectable } from '@angular/core';
import {
  WorkshopDefinition,
  CreateWorkshopDefinitionInput,
  CreateWorkshopSeriesInput,
  WorkshopMedia,
  WorkshopOccurrence,
  WorkshopOccurrenceDraft,
  WorkshopSeries,
  WorkshopSeriesUpdatePatch,
  WorkshopSeriesUpdateResult,
  WorkshopTaxRegion,
} from '../../models/workshop';
import { SupabaseService } from '../clients/supabase.service';

export interface WorkshopCatalogRepository {
  listDefinitions(): Promise<WorkshopDefinition[]>;
  createDefinition(input: CreateWorkshopDefinitionInput): Promise<WorkshopDefinition>;
  updateDefinition(id: string, input: Partial<CreateWorkshopDefinitionInput>): Promise<WorkshopDefinition>;
  updateConcept(id: string, input: CreateWorkshopDefinitionInput, commandKey: string): Promise<WorkshopOccurrence[]>;
  retireDefinition(id: string): Promise<WorkshopDefinition>;
  listOccurrences(): Promise<WorkshopOccurrence[]>;
  getOccurrence(id: string): Promise<WorkshopOccurrence | null>;
  saveOccurrence(draft: WorkshopOccurrenceDraft, commandKey: string): Promise<WorkshopOccurrence>;
  publishOccurrence(id: string, commandKey: string): Promise<WorkshopOccurrence>;
  archiveOccurrence(id: string, commandKey: string): Promise<WorkshopOccurrence>;
  countOccurrenceBookings(id: string): Promise<number>;
  deleteOccurrence(id: string, commandKey: string): Promise<void>;
  listSeries(): Promise<WorkshopSeries[]>;
  createSeries(input: CreateWorkshopSeriesInput): Promise<WorkshopSeries>;
  generateSeries(seriesId: string, drafts: WorkshopOccurrenceDraft[], commandKey: string): Promise<WorkshopOccurrence[]>;
  previewSeriesUpdate(seriesId: string, occurrenceIds: string[], patch: WorkshopSeriesUpdatePatch): Promise<WorkshopSeriesUpdateResult>;
  applySeriesUpdate(seriesId: string, occurrenceIds: string[], patch: WorkshopSeriesUpdatePatch, commandKey: string): Promise<WorkshopSeriesUpdateResult>;
  listMedia(definitionId: string): Promise<WorkshopMedia[]>;
  syncStripeCatalog(definitionId: string, amountMinor: number, commandKey: string): Promise<WorkshopCatalogSyncResult>;
}

export interface WorkshopCatalogSyncResult {
  productId: string;
  priceId: string;
  priceVersionId: string;
  reused: boolean;
}

export function workshopTaxRateBasisPoints(region: WorkshopTaxRegion): number {
  switch (region) {
    case 'RI':
      return 700;
    case 'CT':
      return 635;
    case 'MA':
      return 625;
  }
}

@Injectable({ providedIn: 'root' })
export class WorkshopCatalogRepositoryService implements WorkshopCatalogRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listDefinitions(): Promise<WorkshopDefinition[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_definitions').select('*').order('title');
    if (error) throw error;
    return (data ?? []) as WorkshopDefinition[];
  }

  async createDefinition(input: CreateWorkshopDefinitionInput): Promise<WorkshopDefinition> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_definitions')
      .insert({
        title: input.title.trim(),
        theme: input.theme.trim(),
        advertising_line: input.advertisingLine.trim(),
        description: input.description.trim(),
        included_materials: input.includedMaterials.trim(),
        accessibility_guidance: input.accessibilityGuidance?.trim() || null,
        contact_guidance: input.contactGuidance?.trim() || null,
        default_terms: input.defaultTerms.trim(),
        default_terms_version: 1,
        default_currency: 'USD',
        is_reusable: false,
      })
      .select('*').single();
    if (error) throw error;
    return data as WorkshopDefinition;
  }

  async updateDefinition(
    id: string,
    input: Partial<CreateWorkshopDefinitionInput>,
  ): Promise<WorkshopDefinition> {
    const payload: Record<string, string | null> = {};
    if (input.title !== undefined) payload['title'] = input.title.trim();
    if (input.theme !== undefined) payload['theme'] = input.theme.trim();
    if (input.advertisingLine !== undefined) payload['advertising_line'] = input.advertisingLine.trim();
    if (input.description !== undefined) payload['description'] = input.description.trim();
    if (input.includedMaterials !== undefined) payload['included_materials'] = input.includedMaterials.trim();
    if (input.accessibilityGuidance !== undefined) payload['accessibility_guidance'] = input.accessibilityGuidance?.trim() || null;
    if (input.contactGuidance !== undefined) payload['contact_guidance'] = input.contactGuidance?.trim() || null;
    if (input.defaultTerms !== undefined) payload['default_terms'] = input.defaultTerms.trim();
    const { data, error } = await this.supabase.getClient()
      .from('workshop_definitions').update(payload)
      .eq('workshop_definition_id', id).select('*').single();
    if (error) throw error;
    return data as WorkshopDefinition;
  }

  async updateConcept(
    id: string,
    input: CreateWorkshopDefinitionInput,
    commandKey: string,
  ): Promise<WorkshopOccurrence[]> {
    const patch = {
      title: input.title.trim(),
      theme: input.theme.trim(),
      advertisingLine: input.advertisingLine.trim(),
      description: input.description.trim(),
      includedMaterials: input.includedMaterials.trim(),
      defaultTerms: input.defaultTerms.trim(),
    };
    const { data, error } = await this.supabase.getClient().rpc('update_workshop_concept', {
      p_workshop_definition_id: id,
      p_patch: patch,
      p_command_key: commandKey,
    });
    if (error) throw error;
    return (data ?? []) as WorkshopOccurrence[];
  }

  async retireDefinition(id: string): Promise<WorkshopDefinition> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_definitions')
      .update({ is_reusable: false, reusable_retired_at: new Date().toISOString() })
      .eq('workshop_definition_id', id)
      .select('*').single();
    if (error) throw error;
    return data as WorkshopDefinition;
  }

  async listOccurrences(): Promise<WorkshopOccurrence[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_occurrences').select('*').order('start_at');
    if (error) throw error;
    return (data ?? []) as WorkshopOccurrence[];
  }

  async getOccurrence(id: string): Promise<WorkshopOccurrence | null> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_occurrences').select('*').eq('workshop_occurrence_id', id).maybeSingle();
    if (error) throw error;
    return data as WorkshopOccurrence | null;
  }

  async saveOccurrence(draft: WorkshopOccurrenceDraft, commandKey: string): Promise<WorkshopOccurrence> {
    const { data, error } = await this.supabase.getClient()
      .rpc('save_workshop_occurrence', { p_draft: draft, p_command_key: commandKey });
    if (error) throw error;
    return data as WorkshopOccurrence;
  }

  async publishOccurrence(id: string, commandKey: string): Promise<WorkshopOccurrence> {
    const { data, error } = await this.supabase.getClient().rpc('publish_workshop_occurrence', {
      p_workshop_occurrence_id: id,
      p_command_key: commandKey,
    });
    if (error) throw error;
    return data as WorkshopOccurrence;
  }

  async archiveOccurrence(id: string, commandKey: string): Promise<WorkshopOccurrence> {
    const { data, error } = await this.supabase.getClient().rpc('archive_workshop_occurrence', {
      p_workshop_occurrence_id: id,
      p_command_key: commandKey,
    });
    if (error) throw error;
    return data as WorkshopOccurrence;
  }

  async countOccurrenceBookings(id: string): Promise<number> {
    const { count, error } = await this.supabase.getClient()
      .from('workshop_bookings')
      .select('workshop_booking_id', { count: 'exact', head: true })
      .eq('workshop_occurrence_id', id);
    if (error) throw error;
    return count ?? 0;
  }

  async deleteOccurrence(id: string, commandKey: string): Promise<void> {
    const { error } = await this.supabase.getClient().rpc('delete_workshop_occurrence', {
      p_workshop_occurrence_id: id,
      p_command_key: commandKey,
    });
    if (error) throw error;
  }

  async listSeries(): Promise<WorkshopSeries[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_series').select('*').order('series_label');
    if (error) throw error;
    return (data ?? []) as WorkshopSeries[];
  }

  async createSeries(input: CreateWorkshopSeriesInput): Promise<WorkshopSeries> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_series').insert({
        workshop_definition_id: input.workshopDefinitionId,
        series_label: input.label.trim(),
        default_capacity: input.capacity,
        default_price_minor: input.priceMinor,
        default_tax_region: input.taxRegion,
        default_tax_rate_basis_points: workshopTaxRateBasisPoints(input.taxRegion),
        default_currency: 'USD',
        default_venue_name: input.venueName.trim(),
        default_address_line_1: input.addressLine1.trim(),
        default_address_line_2: input.addressLine2?.trim() || null,
        default_locality: input.locality.trim(),
        default_region: input.region.trim(),
        default_postal_code: input.postalCode.trim(),
        default_country: input.country.trim().toUpperCase(),
        default_timezone: input.timezone.trim(),
      }).select('*').single();
    if (error) throw error;
    return data as WorkshopSeries;
  }

  async generateSeries(
    seriesId: string,
    drafts: WorkshopOccurrenceDraft[],
    commandKey: string,
  ): Promise<WorkshopOccurrence[]> {
    const { data, error } = await this.supabase.getClient().rpc(
      'generate_workshop_series_occurrences',
      {
        p_workshop_series_id: seriesId,
        p_dates: drafts,
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return (data ?? []) as WorkshopOccurrence[];
  }

  async previewSeriesUpdate(
    seriesId: string,
    occurrenceIds: string[],
    patch: WorkshopSeriesUpdatePatch,
  ): Promise<WorkshopSeriesUpdateResult> {
    return this.runSeriesUpdate(seriesId, occurrenceIds, {
      ...patch,
      previewOnly: true,
    }, crypto.randomUUID());
  }

  async applySeriesUpdate(
    seriesId: string,
    occurrenceIds: string[],
    patch: WorkshopSeriesUpdatePatch,
    commandKey: string,
  ): Promise<WorkshopSeriesUpdateResult> {
    return this.runSeriesUpdate(seriesId, occurrenceIds, {
      ...patch,
      previewOnly: false,
    }, commandKey);
  }

  async listMedia(definitionId: string): Promise<WorkshopMedia[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_media').select('*').eq('workshop_definition_id', definitionId)
      .order('display_order');
    if (error) throw error;
    return (data ?? []) as WorkshopMedia[];
  }

  async syncStripeCatalog(
    definitionId: string,
    amountMinor: number,
    commandKey: string,
  ): Promise<WorkshopCatalogSyncResult> {
    const { data, error } = await this.supabase.getClient().functions.invoke(
      'manage-workshop-catalog',
      {
        body: {
          definitionId,
          amountMinor,
          currency: 'USD',
          commandKey,
        },
      },
    );
    if (error) throw error;
    return data as WorkshopCatalogSyncResult;
  }

  toDraft(occurrence: WorkshopOccurrence): WorkshopOccurrenceDraft {
    return {
      workshopOccurrenceId: occurrence.workshop_occurrence_id,
      workshopDefinitionId: occurrence.workshop_definition_id,
      workshopSeriesId: occurrence.workshop_series_id,
      slug: occurrence.slug,
      title: occurrence.title_snapshot,
      advertisingLine: occurrence.advertising_line_snapshot,
      description: occurrence.description_snapshot,
      includedMaterials: occurrence.included_materials_snapshot,
      terms: occurrence.terms_snapshot,
      termsVersion: occurrence.terms_version,
      venueName: occurrence.venue_name,
      addressLine1: occurrence.address_line_1,
      addressLine2: occurrence.address_line_2,
      locality: occurrence.locality,
      region: occurrence.region,
      postalCode: occurrence.postal_code,
      country: occurrence.country,
      timezone: occurrence.timezone,
      localStart: occurrence.local_start,
      localEnd: occurrence.local_end,
      utcOffsetMinutes: occurrence.utc_offset_minutes,
      registrationOpensAt: occurrence.registration_opens_at,
      registrationClosesAt: occurrence.registration_closes_at,
      capacity: occurrence.capacity,
      perBookingLimit: occurrence.per_booking_limit,
      priceMinor: occurrence.price_minor,
      taxRegion: occurrence.tax_region,
      taxRateBasisPoints: occurrence.tax_rate_basis_points,
      currency: occurrence.currency,
      stripePriceVersionId: occurrence.stripe_price_version_id,
      stripeEnabled: occurrence.stripe_enabled,
      venmoEnabled: occurrence.venmo_enabled,
      waitlistEnabled: occurrence.waitlist_enabled,
      isFeatured: occurrence.is_featured,
      featuredOrder: occurrence.featured_order,
    };
  }

  private async runSeriesUpdate(
    seriesId: string,
    occurrenceIds: string[],
    patch: WorkshopSeriesUpdatePatch,
    commandKey: string,
  ): Promise<WorkshopSeriesUpdateResult> {
    const { data, error } = await this.supabase.getClient().rpc(
      'apply_workshop_series_update',
      {
        p_workshop_series_id: seriesId,
        p_occurrence_ids: occurrenceIds,
        p_patch: patch,
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as WorkshopSeriesUpdateResult;
  }
}
