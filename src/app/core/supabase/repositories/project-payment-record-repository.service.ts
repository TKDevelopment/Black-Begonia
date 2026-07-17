import { Injectable } from '@angular/core';

import {
  ProjectPaymentRecord,
  UpsertProjectPaymentRecordInput,
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

  async upsertPaymentRecord(
    payload: UpsertProjectPaymentRecordInput
  ): Promise<ProjectPaymentRecord> {
    const now = new Date().toISOString();
    const record = {
      project_payment_record_id: payload.project_payment_record_id,
      project_id: payload.project_id,
      payment_kind: payload.payment_kind,
      status: payload.status,
      amount_due: payload.amount_due,
      amount_paid: payload.amount_paid ?? 0,
      due_date: payload.due_date ?? null,
      paid_date: payload.paid_date ?? (payload.status === 'paid' ? now : null),
      payment_method: payload.payment_method ?? null,
      payment_source: payload.payment_source ?? 'manual',
      external_payment_id: payload.external_payment_id ?? null,
      notes: payload.notes?.trim() || null,
      recorded_by: payload.recorded_by ?? null,
      updated_at: now,
    };

    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_payment_records')
      .upsert(record, { onConflict: 'project_payment_record_id' })
      .select(this.paymentRecordSelect)
      .single();

    if (error) {
      console.error('[ProjectPaymentRecordRepositoryService] upsertPaymentRecord error:', error);
      throw error;
    }

    return data as ProjectPaymentRecord;
  }
}
