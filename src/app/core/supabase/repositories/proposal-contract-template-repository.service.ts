import { Injectable } from '@angular/core';

import {
  ProposalContractTemplate,
  ProposalContractTemplateUpsertInput,
} from '../../models/proposal-contract-template';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProposalContractTemplateRepositoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly selectClause = `
    proposal_contract_template_id,
    provider,
    provider_template_id,
    provider_template_name,
    provider_template_revision,
    is_active,
    display_name,
    description,
    required_field_map,
    created_by,
    created_at,
    updated_at
  `;

  async getTemplates(): Promise<ProposalContractTemplate[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('proposal_contract_templates')
      .select(this.selectClause)
      .order('is_active', { ascending: false })
      .order('display_name', { ascending: true });

    if (error) {
      console.error(
        '[ProposalContractTemplateRepositoryService] getTemplates error:',
        error
      );
      return [];
    }

    return (data ?? []) as ProposalContractTemplate[];
  }

  async getActiveTemplate(): Promise<ProposalContractTemplate | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('proposal_contract_templates')
      .select(this.selectClause)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(
        '[ProposalContractTemplateRepositoryService] getActiveTemplate error:',
        error
      );
      return null;
    }

    return (data as ProposalContractTemplate | null) ?? null;
  }

  async setActiveTemplate(
    proposalContractTemplateId: string
  ): Promise<ProposalContractTemplate> {
    const client = this.supabaseService.getClient();
    const updatedAt = new Date().toISOString();

    const { error: clearError } = await client
      .from('proposal_contract_templates')
      .update({
        is_active: false,
        updated_at: updatedAt,
      })
      .eq('is_active', true);

    if (clearError) {
      console.error(
        '[ProposalContractTemplateRepositoryService] setActiveTemplate clear error:',
        clearError
      );
      throw clearError;
    }

    const { data, error } = await client
      .from('proposal_contract_templates')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('proposal_contract_template_id', proposalContractTemplateId)
      .select(this.selectClause)
      .single();

    if (error) {
      console.error(
        '[ProposalContractTemplateRepositoryService] setActiveTemplate update error:',
        error
      );
      throw error;
    }

    return data as ProposalContractTemplate;
  }

  async createTemplate(
    payload: ProposalContractTemplateUpsertInput
  ): Promise<ProposalContractTemplate> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('proposal_contract_templates')
      .insert({
        provider: payload.provider?.trim() || 'signwell',
        provider_template_id: payload.provider_template_id.trim(),
        provider_template_name: payload.provider_template_name.trim(),
        provider_template_revision:
          payload.provider_template_revision?.trim() || null,
        is_active: payload.is_active ?? false,
        display_name: payload.display_name.trim(),
        description: payload.description?.trim() || null,
        required_field_map: payload.required_field_map ?? {},
      })
      .select(this.selectClause)
      .single();

    if (error) {
      console.error(
        '[ProposalContractTemplateRepositoryService] createTemplate error:',
        error
      );
      throw error;
    }

    return data as ProposalContractTemplate;
  }

  async updateTemplate(
    proposalContractTemplateId: string,
    updates: Partial<ProposalContractTemplate>
  ): Promise<ProposalContractTemplate> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('proposal_contract_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('proposal_contract_template_id', proposalContractTemplateId)
      .select(this.selectClause)
      .single();

    if (error) {
      console.error(
        '[ProposalContractTemplateRepositoryService] updateTemplate error:',
        error
      );
      throw error;
    }

    return data as ProposalContractTemplate;
  }
}
