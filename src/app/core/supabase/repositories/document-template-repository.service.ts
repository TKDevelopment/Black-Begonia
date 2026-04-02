import { Injectable } from '@angular/core';

import {
  DocumentTemplate,
  DocumentTemplateUpsertInput,
} from '../../models/floral-proposal';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class DocumentTemplateRepositoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly selectClause = `
    template_id,
    name,
    template_key,
    template_kind,
    is_active,
    is_default,
    logo_storage_path,
    logo_url,
    show_terms_section,
    show_privacy_section,
    show_signature_section,
    template_config,
    created_at,
    updated_at
  `;

  async getDocumentTemplates(): Promise<DocumentTemplate[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('document_templates')
      .select(this.selectClause)
      .eq('template_kind', 'floral_proposal')
      .order('name', { ascending: true });

    if (error) {
      console.error(
        '[DocumentTemplateRepositoryService] getDocumentTemplates error:',
        error
      );
      return [];
    }

    return (data ?? []) as DocumentTemplate[];
  }

  async getDocumentTemplateById(templateId: string): Promise<DocumentTemplate | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('document_templates')
      .select(this.selectClause)
      .eq('template_id', templateId)
      .maybeSingle();

    if (error) {
      console.error(
        '[DocumentTemplateRepositoryService] getDocumentTemplateById error:',
        error
      );
      return null;
    }

    return (data as DocumentTemplate | null) ?? null;
  }

  async createDocumentTemplate(
    payload: DocumentTemplateUpsertInput
  ): Promise<DocumentTemplate> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('document_templates')
      .insert({
        name: payload.name,
        template_key: payload.template_key,
        template_kind: payload.template_kind ?? 'floral_proposal',
        is_active: payload.is_active ?? true,
        is_default: payload.is_default ?? false,
        logo_storage_path: payload.logo_storage_path ?? null,
        logo_url: payload.logo_url ?? null,
        show_terms_section: payload.show_terms_section ?? true,
        show_privacy_section: payload.show_privacy_section ?? true,
        show_signature_section: payload.show_signature_section ?? true,
        template_config: payload.template_config ?? {},
      })
      .select(this.selectClause)
      .single();

    if (error || !data) {
      console.error(
        '[DocumentTemplateRepositoryService] createDocumentTemplate error:',
        error
      );
      throw error ?? new Error('Unable to create proposal template.');
    }

    return data as DocumentTemplate;
  }

  async updateDocumentTemplate(
    templateId: string,
    updates: Partial<DocumentTemplateUpsertInput>
  ): Promise<DocumentTemplate> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('document_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('template_id', templateId)
      .select(this.selectClause)
      .single();

    if (error || !data) {
      console.error(
        '[DocumentTemplateRepositoryService] updateDocumentTemplate error:',
        error
      );
      throw error ?? new Error('Unable to update proposal template.');
    }

    return data as DocumentTemplate;
  }
}
