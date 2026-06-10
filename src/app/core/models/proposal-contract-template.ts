export interface ProposalContractTemplate {
  proposal_contract_template_id: string;
  provider: string;
  provider_template_id: string;
  provider_template_name: string;
  provider_template_revision?: string | null;
  is_active: boolean;
  display_name: string;
  description?: string | null;
  required_field_map: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalContractTemplateUpsertInput {
  provider?: string;
  provider_template_id: string;
  provider_template_name: string;
  provider_template_revision?: string | null;
  is_active?: boolean;
  display_name: string;
  description?: string | null;
  required_field_map?: Record<string, unknown>;
}
