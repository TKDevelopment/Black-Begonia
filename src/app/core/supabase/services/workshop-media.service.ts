import { Injectable } from '@angular/core';

import { WorkshopMedia, WorkshopMediaRole } from '../../models/workshop';
import { SupabaseService } from '../clients/supabase.service';

export interface WorkshopMediaUpload {
  owner: { definitionId: string; occurrenceId?: never } | { definitionId?: never; occurrenceId: string };
  role: WorkshopMediaRole;
  file: File;
  altText: string;
  displayOrder: number;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class WorkshopMediaService {
  private readonly bucketName = 'workshop-media';
  private readonly allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

  constructor(private readonly supabase: SupabaseService) {}

  validateImage(file: File, altText: string): string[] {
    const errors: string[] = [];
    if (!this.allowedTypes.has(file.type)) errors.push('Choose a JPEG, PNG, WebP, or AVIF image.');
    if (file.size > 10 * 1024 * 1024) errors.push('Images must be 10 MB or smaller.');
    if (!altText.trim()) errors.push('Alternative text is required.');
    return errors;
  }

  async upload(input: WorkshopMediaUpload): Promise<WorkshopMedia> {
    const errors = this.validateImage(input.file, input.altText);
    if (errors.length) throw new Error(errors.join(' '));
    if (input.width <= 0 || input.height <= 0) throw new Error('Image dimensions are required.');

    const ownerSegment = 'definitionId' in input.owner
      ? `definitions/${input.owner.definitionId}`
      : `occurrences/${input.owner.occurrenceId}`;
    const extension = input.file.name.split('.').pop()?.toLowerCase() || 'image';
    const path = `${ownerSegment}/${input.role}-${crypto.randomUUID()}.${extension}`;
    this.assertPublicMediaPath(path);

    const client = this.supabase.getClient();
    const bucket = client.storage.from(this.bucketName);
    const { error: uploadError } = await bucket.upload(path, input.file, {
      upsert: false,
      contentType: input.file.type,
      cacheControl: '31536000',
    });
    if (uploadError) throw uploadError;

    try {
      const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
      const { data, error } = await client.from('workshop_media').insert({
        workshop_definition_id: 'definitionId' in input.owner ? input.owner.definitionId : null,
        workshop_occurrence_id: 'occurrenceId' in input.owner ? input.owner.occurrenceId : null,
        media_role: input.role,
        storage_path: path,
        public_url: publicUrl,
        alt_text: input.altText.trim(),
        display_order: input.displayOrder,
        is_public: true,
        width: input.width,
        height: input.height,
        byte_size: input.file.size,
        mime_type: input.file.type,
      }).select('*').single();
      if (error) throw error;
      return data as WorkshopMedia;
    } catch (error) {
      await bucket.remove([path]);
      throw error;
    }
  }

  async reorder(media: WorkshopMedia[]): Promise<void> {
    await Promise.all(media.map(async (item, index) => {
      const { error } = await this.supabase.getClient().from('workshop_media')
        .update({ display_order: index })
        .eq('workshop_media_id', item.workshop_media_id);
      if (error) throw error;
    }));
  }

  async replace(existing: WorkshopMedia, input: WorkshopMediaUpload): Promise<WorkshopMedia> {
    this.assertPublicMediaPath(existing.storage_path);
    const replacement = await this.upload(input);
    try {
      await this.remove(existing);
      return replacement;
    } catch (error) {
      await this.remove(replacement);
      throw error;
    }
  }

  async remove(media: WorkshopMedia): Promise<void> {
    this.assertPublicMediaPath(media.storage_path);
    const client = this.supabase.getClient();
    const { error } = await client.from('workshop_media')
      .delete().eq('workshop_media_id', media.workshop_media_id);
    if (error) throw error;
    const { error: storageError } = await client.storage.from(this.bucketName).remove([media.storage_path]);
    if (storageError) throw storageError;
  }

  assertPublicMediaPath(path: string): void {
    const normalized = path.replace(/\\/g, '/').toLowerCase();
    if (normalized.includes('workshop-receipts') || normalized.includes('../')) {
      throw new Error('Receipt evidence and unsafe paths cannot be stored as public workshop media.');
    }
  }
}
