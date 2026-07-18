import { Injectable } from '@angular/core';

import {
  CreateProjectProposalInvoiceSnapshotInput,
  ProjectProposalInvoiceSnapshot,
} from '../../models/project-proposal-invoice-snapshot';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectProposalInvoiceSnapshotRepositoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly snapshotSelect = `
    project_proposal_invoice_snapshot_id,
    project_id,
    source_lead_id,
    source_floral_proposal_id,
    version,
    snapshot,
    subtotal,
    tax_rate,
    tax_amount,
    total_amount,
    retainer_amount,
    final_balance_amount,
    retainer_due_date,
    final_balance_due_date,
    created_by,
    created_at,
    is_active
    ,submission_idempotency_key
  `;

  async getProjectSnapshots(projectId: string): Promise<ProjectProposalInvoiceSnapshot[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_proposal_invoice_snapshots')
      .select(this.snapshotSelect)
      .eq('project_id', projectId)
      .order('version', { ascending: true });

    if (error) {
      console.error('[ProjectProposalInvoiceSnapshotRepositoryService] getProjectSnapshots error:', error);
      throw error;
    }

    return (data ?? []) as ProjectProposalInvoiceSnapshot[];
  }

  async getActiveProjectSnapshot(projectId: string): Promise<ProjectProposalInvoiceSnapshot | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_proposal_invoice_snapshots')
      .select(this.snapshotSelect)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[ProjectProposalInvoiceSnapshotRepositoryService] getActiveProjectSnapshot error:', error);
      throw error;
    }

    return (data as ProjectProposalInvoiceSnapshot | null) ?? null;
  }

  async getProjectSnapshotById(
    projectId: string,
    snapshotId: string
  ): Promise<ProjectProposalInvoiceSnapshot | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_proposal_invoice_snapshots')
      .select(this.snapshotSelect)
      .eq('project_id', projectId)
      .eq('project_proposal_invoice_snapshot_id', snapshotId)
      .maybeSingle();
    if (error) throw error;
    return (data as ProjectProposalInvoiceSnapshot | null) ?? null;
  }

  async createSnapshot(
    payload: CreateProjectProposalInvoiceSnapshotInput
  ): Promise<ProjectProposalInvoiceSnapshot> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_proposal_invoice_snapshots')
      .insert({
        project_id: payload.project_id,
        source_lead_id: payload.source_lead_id ?? null,
        source_floral_proposal_id: payload.source_floral_proposal_id ?? null,
        version: payload.version,
        snapshot: payload.snapshot ?? {},
        subtotal: payload.subtotal ?? 0,
        tax_rate: payload.tax_rate ?? 0,
        tax_amount: payload.tax_amount ?? 0,
        total_amount: payload.total_amount ?? 0,
        retainer_amount: payload.retainer_amount ?? 0,
        final_balance_amount: payload.final_balance_amount ?? payload.total_amount ?? 0,
        retainer_due_date: payload.retainer_due_date ?? null,
        final_balance_due_date: payload.final_balance_due_date ?? null,
        created_by: payload.created_by ?? null,
        is_active: payload.is_active ?? true,
        submission_idempotency_key: payload.submission_idempotency_key ?? null,
      })
      .select(this.snapshotSelect)
      .single();

    if (error) {
      console.error('[ProjectProposalInvoiceSnapshotRepositoryService] createSnapshot error:', error);
      throw error;
    }

    return data as ProjectProposalInvoiceSnapshot;
  }
}
