import { Injectable } from '@angular/core';

import {
  CreateProjectProposalDocumentVersionInput,
  ProjectProposalDocumentVersion,
} from '../../models/project-proposal-document-version';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectProposalDocumentVersionRepositoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly documentVersionSelect = `
    project_proposal_document_version_id,
    project_id,
    source_lead_id,
    source_floral_proposal_id,
    invoice_snapshot_id,
    version,
    file_name,
    storage_bucket,
    storage_path,
    content_type,
    file_size_bytes,
    uploaded_by,
    submitted_at,
    is_active,
    created_at
  `;

  async getProjectDocumentVersions(projectId: string): Promise<ProjectProposalDocumentVersion[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_proposal_document_versions')
      .select(this.documentVersionSelect)
      .eq('project_id', projectId)
      .order('version', { ascending: false });

    if (error) {
      console.error('[ProjectProposalDocumentVersionRepositoryService] getProjectDocumentVersions error:', error);
      return [];
    }

    return (data ?? []) as ProjectProposalDocumentVersion[];
  }

  async getActiveProjectDocumentVersion(projectId: string): Promise<ProjectProposalDocumentVersion | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_proposal_document_versions')
      .select(this.documentVersionSelect)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[ProjectProposalDocumentVersionRepositoryService] getActiveProjectDocumentVersion error:', error);
      return null;
    }

    return (data as ProjectProposalDocumentVersion | null) ?? null;
  }

  async createDocumentVersion(
    payload: CreateProjectProposalDocumentVersionInput
  ): Promise<ProjectProposalDocumentVersion> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_proposal_document_versions')
      .insert({
        project_id: payload.project_id,
        source_lead_id: payload.source_lead_id ?? null,
        source_floral_proposal_id: payload.source_floral_proposal_id ?? null,
        invoice_snapshot_id: payload.invoice_snapshot_id ?? null,
        version: payload.version,
        file_name: payload.file_name.trim(),
        storage_bucket: payload.storage_bucket ?? 'floral-proposals',
        storage_path: payload.storage_path,
        content_type: payload.content_type ?? 'application/pdf',
        file_size_bytes: payload.file_size_bytes ?? null,
        uploaded_by: payload.uploaded_by ?? null,
        submitted_at: payload.submitted_at ?? new Date().toISOString(),
        is_active: payload.is_active ?? true,
      })
      .select(this.documentVersionSelect)
      .single();

    if (error) {
      console.error('[ProjectProposalDocumentVersionRepositoryService] createDocumentVersion error:', error);
      throw error;
    }

    return data as ProjectProposalDocumentVersion;
  }
}
