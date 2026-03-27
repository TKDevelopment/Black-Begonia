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
    primary_color,
    accent_color,
    heading_font_family,
    body_font_family,
    header_layout,
    line_item_layout,
    footer_layout,
    show_cover_page,
    show_intro_message,
    intro_title,
    intro_body,
    show_terms_section,
    show_privacy_section,
    show_signature_section,
    agreement_clauses,
    header_content,
    footer_content,
    body_config,
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
        primary_color: payload.primary_color ?? '#111111',
        accent_color: payload.accent_color ?? '#ea938c',
        heading_font_family: payload.heading_font_family ?? 'Cormorant Garamond',
        body_font_family: payload.body_font_family ?? 'Source Sans 3',
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
