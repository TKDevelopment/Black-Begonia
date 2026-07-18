import { Injectable } from '@angular/core';

import {
  ProjectProposalRevisionWorkspace,
  SaveProjectProposalRevisionWorkspaceInput,
} from '../../models/project-proposal-revision-workspace';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({ providedIn: 'root' })
export class ProjectProposalRevisionWorkspaceRepositoryService {
  private readonly select = `
    project_proposal_revision_workspace_id, project_id, baseline_invoice_snapshot_id,
    source_lead_id, schema_version, draft_snapshot, subtotal, tax_rate, tax_amount,
    total_amount, retainer_amount, final_balance_amount, retainer_due_date,
    final_balance_due_date, pending_submission_key, pending_pdf_storage_path,
    pending_pdf_file_name, created_by, updated_by, created_at, updated_at
  `;

  constructor(private readonly supabaseService: SupabaseService) {}

  async getForProject(projectId: string): Promise<ProjectProposalRevisionWorkspace | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_proposal_revision_workspaces')
      .select(this.select)
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) throw error;
    return (data as ProjectProposalRevisionWorkspace | null) ?? null;
  }

  async createOrGet(
    input: SaveProjectProposalRevisionWorkspaceInput
  ): Promise<ProjectProposalRevisionWorkspace> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_proposal_revision_workspaces')
      .insert(input)
      .select(this.select)
      .single();

    if (!error) return data as ProjectProposalRevisionWorkspace;
    if ((error as { code?: string }).code === '23505') {
      const existing = await this.getForProject(input.project_id);
      if (existing) return existing;
    }
    throw error;
  }

  async update(
    workspaceId: string,
    projectId: string,
    updates: Partial<SaveProjectProposalRevisionWorkspaceInput>
  ): Promise<ProjectProposalRevisionWorkspace> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_proposal_revision_workspaces')
      .update(updates)
      .eq('project_proposal_revision_workspace_id', workspaceId)
      .eq('project_id', projectId)
      .select(this.select)
      .single();

    if (error) throw error;
    return data as ProjectProposalRevisionWorkspace;
  }

  async discard(workspaceId: string, projectId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('project_proposal_revision_workspaces')
      .delete()
      .eq('project_proposal_revision_workspace_id', workspaceId)
      .eq('project_id', projectId);

    if (error) throw error;
  }
}
