import { Injectable } from '@angular/core';

import {
  DocumentTemplate,
  DocumentTemplateLogoUploadResult,
  DocumentTemplateUpsertInput,
} from '../../models/floral-proposal';
import { DocumentTemplateRepositoryService } from '../repositories/document-template-repository.service';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class DocumentTemplateService {
  private readonly templateAssetBucket = 'proposal-template-assets';
  private readonly signedUrlExpirySeconds = 60 * 60;

  constructor(
    private readonly documentTemplateRepository: DocumentTemplateRepositoryService,
    private readonly supabaseService: SupabaseService
  ) {}

  async createDocumentTemplate(
    payload: DocumentTemplateUpsertInput
  ): Promise<DocumentTemplate> {
    return this.documentTemplateRepository.createDocumentTemplate(payload);
  }

  async updateDocumentTemplate(
    templateId: string,
    updates: Partial<DocumentTemplateUpsertInput>
  ): Promise<DocumentTemplate> {
    return this.documentTemplateRepository.updateDocumentTemplate(templateId, updates);
  }

  async deactivateTemplate(template: DocumentTemplate): Promise<DocumentTemplate> {
    return this.updateDocumentTemplate(template.template_id, { is_active: false });
  }

  async activateTemplate(template: DocumentTemplate): Promise<DocumentTemplate> {
    return this.updateDocumentTemplate(template.template_id, { is_active: true });
  }

  async uploadTemplateLogo(
    templateId: string,
    file: File
  ): Promise<DocumentTemplateLogoUploadResult> {
    const sanitizedFileName = file.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, '-')
      .replace(/-+/g, '-');
    const storagePath = `${templateId}/${Date.now()}-${sanitizedFileName}`;

    const { error } = await this.supabaseService
      .getClient()
      .storage
      .from(this.templateAssetBucket)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[DocumentTemplateService] uploadTemplateLogo error:', error);
      throw new Error('We could not upload the template logo right now.');
    }

    const signedUrl = await this.getSignedTemplateLogoUrl(storagePath);
    return { storagePath, signedUrl };
  }

  async uploadTemplateAsset(
    templateId: string,
    file: File,
    assetType: 'logo' | 'background' | 'texture' | 'image'
  ): Promise<{
    id: string;
    type: 'logo' | 'background' | 'texture' | 'image';
    url: string;
    storage_path: string;
    alt: string;
  }> {
    const sanitizedFileName = file.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, '-')
      .replace(/-+/g, '-');
    const assetId = `${assetType}-${Date.now()}`;
    const storagePath = `${templateId}/assets/${assetId}-${sanitizedFileName}`;

    const { error } = await this.supabaseService
      .getClient()
      .storage
      .from(this.templateAssetBucket)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[DocumentTemplateService] uploadTemplateAsset error:', error);
      throw new Error('We could not upload the template asset right now.');
    }

    const signedUrl = await this.getSignedTemplateLogoUrl(storagePath);
    return {
      id: assetId,
      type: assetType,
      url: signedUrl,
      storage_path: storagePath,
      alt: file.name,
    };
  }

  async removeTemplateLogo(storagePath: string): Promise<void> {
    if (!storagePath) return;

    const { error } = await this.supabaseService
      .getClient()
      .storage
      .from(this.templateAssetBucket)
      .remove([storagePath]);

    if (error) {
      console.error('[DocumentTemplateService] removeTemplateLogo error:', error);
      throw new Error('We could not remove the template logo right now.');
    }
  }

  async removeTemplateAsset(storagePath: string): Promise<void> {
    return this.removeTemplateLogo(storagePath);
  }

  async getSignedTemplateLogoUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.supabaseService
      .getClient()
      .storage
      .from(this.templateAssetBucket)
      .createSignedUrl(storagePath, this.signedUrlExpirySeconds);

    if (error || !data?.signedUrl) {
      console.error('[DocumentTemplateService] getSignedTemplateLogoUrl error:', error);
      throw new Error('We could not load the template logo right now.');
    }

    return data.signedUrl;
  }
}
