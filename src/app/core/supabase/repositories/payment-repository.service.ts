import { Injectable } from '@angular/core';
import { PaymentCheckoutAttempt, PaymentTransaction } from '../../models/payment-transaction';
import { PaymentCollectionSettings, PaymentDelivery, PaymentIntention } from '../../models/payment-delivery';
import { PaymentException, PaymentLegalHold } from '../../models/payment-exception';
import { PaymentRequest } from '../../models/payment-request';
import { ProjectPaymentRecord } from '../../models/project-payment-record';
import { ActivityLogEntry } from '../../models/activity-log';
import { SupabaseService } from '../clients/supabase.service';

export interface PaymentObligationListRow extends ProjectPaymentRecord {
  project_name: string; event_date?: string | null; customer_name?: string | null; customer_email?: string | null;
  has_exception: boolean; has_delivery_issue: boolean;
}
export interface PaymentObligationQuery { search?: string; kind?: string; state?: string; method?: string; dueTiming?: string; sort?: string; direction?: 'asc' | 'desc'; page?: number; pageSize?: number; }
export interface PaymentObligationPage { rows: PaymentObligationListRow[]; total: number; page: number; pageSize: number; }
export interface PaymentObligationDetail { obligation: ProjectPaymentRecord; project: { project_id: string; project_name: string; event_date?: string | null; status: string }; requests: PaymentRequest[]; checkouts: PaymentCheckoutAttempt[]; intentions: PaymentIntention[]; transactions: PaymentTransaction[]; deliveries: PaymentDelivery[]; exceptions: PaymentException[]; legalHolds: PaymentLegalHold[]; activity: ActivityLogEntry[]; }

@Injectable({ providedIn: 'root' })
export class PaymentRepositoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listObligations(query: PaymentObligationQuery = {}): Promise<PaymentObligationPage> {
    const { data, error } = await this.supabaseService.getClient().rpc('list_payment_obligations', {
      p_search: query.search?.trim() || null, p_kind: query.kind || null, p_state: query.state || null,
      p_method: query.method || null, p_due_timing: query.dueTiming || null, p_sort: query.sort || 'event_date',
      p_direction: query.direction || 'asc', p_page: query.page || 1, p_page_size: query.pageSize || 25,
    });
    if (error) throw error;
    return data as PaymentObligationPage;
  }

  async getObligationDetail(obligationId: string): Promise<PaymentObligationDetail | null> {
    const { data, error } = await this.supabaseService.getClient().rpc('get_payment_obligation_detail', { p_obligation_id: obligationId });
    if (error) throw error;
    return data as PaymentObligationDetail | null;
  }

  async getSettings(): Promise<PaymentCollectionSettings> {
    const { data, error } = await this.supabaseService.getClient().from('payment_collection_settings').select('*').single();
    if (error) throw error;
    return data as PaymentCollectionSettings;
  }

  async updateSettings(settings: Partial<PaymentCollectionSettings>, commandKey: string): Promise<PaymentCollectionSettings> {
    void commandKey;
    const { data, error } = await this.supabaseService.getClient().rpc('update_payment_collection_settings', {
      p_business_timezone: settings.business_timezone,
      p_send_window_start: settings.send_window_start,
      p_send_window_end: settings.send_window_end,
      p_cash_instructions: settings.cash_instructions,
      p_check_instructions: settings.check_instructions,
      p_venmo_business_target: settings.venmo_business_target ?? null,
      p_stripe_enabled: settings.stripe_enabled,
      p_venmo_enabled: settings.venmo_enabled,
      p_reminders_enabled: settings.reminders_enabled,
      p_collection_enabled: settings.collection_enabled,
      p_provider_environment: settings.provider_environment,
    });
    if (error) throw error;
    return data as PaymentCollectionSettings;
  }

  async setLegalHold(projectId: string, action: 'placed' | 'released', holdType: 'legal' | 'dispute', reason: string, commandKey: string): Promise<PaymentLegalHold> {
    const { data, error } = await this.supabaseService.getClient().rpc('set_payment_legal_hold', { p_project_id: projectId, p_action: action, p_hold_type: holdType, p_reason: reason.trim(), p_command_key: commandKey });
    if (error) throw error;
    return data as PaymentLegalHold;
  }

  async revokeRequest(requestId:string,reason:string):Promise<void>{const{error}=await this.supabaseService.getClient().rpc('revoke_payment_request',{p_request_id:requestId,p_reason:reason.trim()});if(error)throw error;}
  async setObligationState(obligationId:string,state:'waived'|'canceled',reason:string):Promise<void>{const{error}=await this.supabaseService.getClient().rpc('set_payment_obligation_state',{p_obligation_id:obligationId,p_state:state,p_reason:reason.trim(),p_command_key:crypto.randomUUID()});if(error)throw error;}
  async resolveException(exceptionId:string,resolution:string,referenceOrNote:string):Promise<void>{const{error}=await this.supabaseService.getClient().rpc('resolve_payment_exception',{p_exception_id:exceptionId,p_resolution:resolution,p_reference_or_note:referenceOrNote.trim()});if(error)throw error;}
}
