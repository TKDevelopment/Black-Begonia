import { Injectable } from '@angular/core';

import { LeadInspirationUrl } from '../../models/lead-inspiration-url';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class LeadInspirationUrlRepositoryService {
  private readonly inspirationPhotoBucket = 'lead-inspiration-photos';

  constructor(private supabaseService: SupabaseService) {}

  private readonly inspirationSelect = `
    lead_inspiration_url_id,
    lead_id,
    url,
    created_at
  `;

  async getInspirationUrlsByLeadId(leadId: string): Promise<LeadInspirationUrl[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('lead_inspiration_urls')
      .select(this.inspirationSelect)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[LeadInspirationUrlRepositoryService] getInspirationUrlsByLeadId error:', error);
      return [];
    }

    return (data ?? []) as LeadInspirationUrl[];
  }

  async uploadInspirationPhoto(
    leadId: string,
    file: File
  ): Promise<LeadInspirationUrl> {
    const sanitizedFileName = file.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, '-')
      .replace(/-+/g, '-');
    const storagePath = `${leadId}/${Date.now()}-${sanitizedFileName}`;
    const client = this.supabaseService.getClient();

    const { error: uploadError } = await client.storage
      .from(this.inspirationPhotoBucket)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error(
        '[LeadInspirationUrlRepositoryService] uploadInspirationPhoto upload error:',
        uploadError
      );
      throw new Error('We could not upload the inspiration photo right now.');
    }

    const { data: publicUrlData } = client.storage
      .from(this.inspirationPhotoBucket)
      .getPublicUrl(storagePath);

    const { data, error } = await client
      .from('lead_inspiration_urls')
      .insert({
        lead_id: leadId,
        url: publicUrlData.publicUrl,
      })
      .select(this.inspirationSelect)
      .single();

    if (error) {
      console.error(
        '[LeadInspirationUrlRepositoryService] uploadInspirationPhoto insert error:',
        error
      );
      throw new Error('The photo uploaded, but we could not save its link.');
    }

    return data as LeadInspirationUrl;
  }

  async deleteInspirationPhoto(inspiration: LeadInspirationUrl): Promise<void> {
    const client = this.supabaseService.getClient();
    const storagePath = this.getStoragePathFromUrl(inspiration.url);

    if (!storagePath) {
      throw new Error('We could not determine which storage file to delete.');
    }

    const { error: storageError } = await client.storage
      .from(this.inspirationPhotoBucket)
      .remove([storagePath]);

    if (storageError) {
      console.error(
        '[LeadInspirationUrlRepositoryService] deleteInspirationPhoto storage error:',
        storageError
      );
      throw new Error('We could not delete the inspiration photo from storage.');
    }

    const { error } = await client
      .from('lead_inspiration_urls')
      .delete()
      .eq('lead_inspiration_url_id', inspiration.lead_inspiration_url_id);

    if (error) {
      console.error(
        '[LeadInspirationUrlRepositoryService] deleteInspirationPhoto row error:',
        error
      );
      throw new Error('The photo was removed from storage, but the CRM link could not be deleted.');
    }
  }

  private getStoragePathFromUrl(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      const bucketPathMarker = `/storage/v1/object/public/${this.inspirationPhotoBucket}/`;
      const markerIndex = parsedUrl.pathname.indexOf(bucketPathMarker);

      if (markerIndex === -1) {
        return null;
      }

      return decodeURIComponent(
        parsedUrl.pathname.slice(markerIndex + bucketPathMarker.length)
      );
    } catch (error) {
      console.error(
        '[LeadInspirationUrlRepositoryService] getStoragePathFromUrl error:',
        error
      );
      return null;
    }
  }
}
