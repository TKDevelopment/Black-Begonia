import { Injectable } from '@angular/core';
import { PublicWorkshopOccurrence, PublicWorkshopSummary } from '../../models/workshop';
import { SupabaseService } from '../clients/supabase.service';

export interface WorkshopPublicRepository {
  listUpcoming(): Promise<PublicWorkshopSummary[]>;
  getBySlug(slug: string): Promise<PublicWorkshopOccurrence | null>;
  getByRoute(seriesSlug: string, workshopDate: string): Promise<PublicWorkshopOccurrence | null>;
}

@Injectable({ providedIn: 'root' })
export class WorkshopPublicRepositoryService implements WorkshopPublicRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listUpcoming(): Promise<PublicWorkshopSummary[]> {
    const { data, error } = await this.supabase.getClient().rpc('get_public_workshop_listing');
    if (error) throw error;
    return (data ?? []) as PublicWorkshopSummary[];
  }

  async getBySlug(slug: string): Promise<PublicWorkshopOccurrence | null> {
    const { data, error } = await this.supabase.getClient().rpc('get_public_workshop_occurrence', {
      p_slug: slug,
    });
    if (error) throw error;
    return (data ?? null) as PublicWorkshopOccurrence | null;
  }

  async getByRoute(
    seriesSlug: string,
    workshopDate: string,
  ): Promise<PublicWorkshopOccurrence | null> {
    const { data, error } = await this.supabase.getClient().rpc(
      'get_public_workshop_occurrence_route',
      { p_series_slug: seriesSlug, p_workshop_date: workshopDate },
    );
    if (error) throw error;
    return (data ?? null) as PublicWorkshopOccurrence | null;
  }
}
