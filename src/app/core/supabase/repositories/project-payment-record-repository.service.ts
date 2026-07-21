import { Injectable } from '@angular/core';

import {
  ProjectPaymentRecord,
  ProjectFinancialSummary,
} from '../../models/project-payment-record';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectPaymentRecordRepositoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly paymentRecordSelect = `
    project_payment_record_id,
    project_id,
    payment_kind,
    status,
    amount_due,
    amount_paid,
    due_date,
    paid_date,
    payment_method,
    payment_source,
    external_payment_id,
    notes,
    recorded_by,
    created_at,
    updated_at
    ,basis_snapshot_id
    ,basis_version
    ,basis_total
    ,target_amount
    ,credited_principal
    ,outstanding_amount
    ,fulfillment_state
    ,deposit_target_frozen_at
    ,reminder_enabled
    ,reminder_paused_until
    ,reminder_pause_reason
    ,migration_state
    ,fulfilled_at
    ,retention_eligible_at
    ,last_method
    ,last_intention_method
  `;

  async getProjectPaymentRecords(projectId: string): Promise<ProjectPaymentRecord[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_payment_records')
      .select(this.paymentRecordSelect)
      .eq('project_id', projectId)
      .neq('status', 'canceled')
      .order('payment_kind', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('[ProjectPaymentRecordRepositoryService] getProjectPaymentRecords error:', error);
      return [];
    }

    return (data ?? []) as ProjectPaymentRecord[];
  }

  async getProjectFinancialSummary(projectId: string): Promise<ProjectFinancialSummary> {
    const { data, error } = await this.supabaseService.getClient().rpc(
      'get_project_financial_summary',
      { p_project_id: projectId }
    );

    if (error) {
      console.error('[ProjectPaymentRecordRepositoryService] getProjectFinancialSummary error:', error);
      throw error;
    }
    return data as ProjectFinancialSummary;
  }
}
