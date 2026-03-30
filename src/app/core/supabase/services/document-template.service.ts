import { Injectable } from '@angular/core';

import {
  DocumentTemplate,
  DocumentTemplateLogoUploadResult,
  DocumentTemplateUpsertInput,
} from '../../models/floral-proposal';
import { DocumentTemplateStudioBridgeService } from '../../templates/document-template-studio-bridge.service';
import {
  StoredTemplateStudioConfig,
  TemplateAssetRef,
  TemplateDefinition,
} from '../../templates/template-studio.models';
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
    private readonly supabaseService: SupabaseService,
    private readonly documentTemplateStudioBridge: DocumentTemplateStudioBridgeService
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

  async createTemplateStudioDocumentTemplate(
    payload: DocumentTemplateUpsertInput,
    templateDefinition: TemplateDefinition
  ): Promise<DocumentTemplate> {
    const now = new Date().toISOString();
    const studioPayload = this.documentTemplateStudioBridge.buildUpsertInput(templateDefinition, {
      template_id: '',
      name: payload.name,
      template_key: payload.template_key,
      template_kind: payload.template_kind ?? 'floral_proposal',
      is_active: payload.is_active ?? true,
      is_default: payload.is_default ?? false,
      logo_storage_path: payload.logo_storage_path ?? null,
      logo_url: payload.logo_url ?? null,
      primary_color: payload.primary_color ?? null,
      accent_color: payload.accent_color ?? null,
      heading_font_family: payload.heading_font_family ?? null,
      body_font_family: payload.body_font_family ?? null,
      header_layout: payload.header_layout ?? 'editorial',
      line_item_layout: payload.line_item_layout ?? 'image_left',
      footer_layout: payload.footer_layout ?? 'signature_focused',
      show_cover_page: payload.show_cover_page ?? true,
      show_intro_message: payload.show_intro_message ?? true,
      intro_title: payload.intro_title ?? null,
      intro_body: payload.intro_body ?? null,
      show_terms_section: payload.show_terms_section ?? true,
      show_privacy_section: payload.show_privacy_section ?? true,
      show_signature_section: payload.show_signature_section ?? true,
      agreement_clauses: payload.agreement_clauses ?? [],
      header_content: payload.header_content ?? {},
      footer_content: payload.footer_content ?? {},
      body_config: payload.body_config ?? {},
      template_config: payload.template_config ?? {},
      created_at: now,
      updated_at: now,
    });

    return this.createDocumentTemplate({
      ...payload,
      ...studioPayload,
    });
  }

  async updateTemplateStudioDocumentTemplate(
    currentTemplate: DocumentTemplate,
    templateDefinition: TemplateDefinition,
    updates: Partial<DocumentTemplateUpsertInput> = {},
    storedConfigOverrides: Partial<StoredTemplateStudioConfig> = {}
  ): Promise<DocumentTemplate> {
    const studioPayload = this.documentTemplateStudioBridge.buildUpsertInput(
      templateDefinition,
      currentTemplate,
      storedConfigOverrides
    );

    return this.updateDocumentTemplate(currentTemplate.template_id, {
      ...updates,
      ...studioPayload,
    });
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
    assetType: TemplateAssetRef['type']
  ): Promise<TemplateAssetRef> {
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
