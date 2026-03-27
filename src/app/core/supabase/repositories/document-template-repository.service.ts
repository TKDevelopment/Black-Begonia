import { Injectable } from '@angular/core';

import { DocumentTemplate } from '../../models/floral-proposal';
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
    header_content,
    footer_content,
    body_config,
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
}
