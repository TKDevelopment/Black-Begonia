import { Injectable } from '@angular/core';
import {
  WorkshopDataRetentionPolicy,
  WorkshopPersonalDataRequest,
  WorkshopPersonalDataCommandResult,
  WorkshopRetentionPolicyCommandResult,
  WorkshopRetentionPolicyDraft,
} from '../../models/workshop-booking';
import { SupabaseService } from '../clients/supabase.service';

export interface WorkshopPrivacyRepository {
  listPersonalDataRequests(): Promise<WorkshopPersonalDataRequest[]>;
  listRetentionPolicies(): Promise<WorkshopDataRetentionPolicy[]>;
  getActiveRetentionPolicy(): Promise<WorkshopDataRetentionPolicy | null>;
  createPolicyDraft(
    draft: WorkshopRetentionPolicyDraft,
    commandKey: string,
  ): Promise<WorkshopRetentionPolicyCommandResult>;
  approvePolicy(policyId: string, commandKey: string): Promise<WorkshopRetentionPolicyCommandResult>;
  activatePolicy(
    policyId: string,
    effectiveAt: string,
    commandKey: string,
  ): Promise<WorkshopRetentionPolicyCommandResult>;
  retirePolicy(policyId: string, commandKey: string): Promise<WorkshopRetentionPolicyCommandResult>;
  processPersonalDataRequest(
    requestId: string,
    decision: 'approve' | 'deny',
    reasonCategory: string,
    commandKey: string,
  ): Promise<WorkshopPersonalDataCommandResult>;
}

@Injectable({ providedIn: 'root' })
export class WorkshopPrivacyRepositoryService implements WorkshopPrivacyRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listPersonalDataRequests(): Promise<WorkshopPersonalDataRequest[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_personal_data_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkshopPersonalDataRequest[];
  }

  async listRetentionPolicies(): Promise<WorkshopDataRetentionPolicy[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_data_retention_policies').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkshopDataRetentionPolicy[];
  }

  async getActiveRetentionPolicy(): Promise<WorkshopDataRetentionPolicy | null> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_data_retention_policies').select('*').eq('state', 'active').maybeSingle();
    if (error) throw error;
    return data as WorkshopDataRetentionPolicy | null;
  }

  createPolicyDraft(
    draft: WorkshopRetentionPolicyDraft,
    commandKey: string,
  ): Promise<WorkshopRetentionPolicyCommandResult> {
    return this.runPolicyCommand('create_draft', {
      ...draft,
      policyVersion: draft.policyVersion.trim(),
    }, commandKey);
  }

  approvePolicy(
    policyId: string,
    commandKey: string,
  ): Promise<WorkshopRetentionPolicyCommandResult> {
    return this.runPolicyCommand('approve', { policyId }, commandKey);
  }

  activatePolicy(
    policyId: string,
    effectiveAt: string,
    commandKey: string,
  ): Promise<WorkshopRetentionPolicyCommandResult> {
    return this.runPolicyCommand(
      'activate',
      { policyId, effectiveAt, confirmed: true },
      commandKey,
    );
  }

  retirePolicy(
    policyId: string,
    commandKey: string,
  ): Promise<WorkshopRetentionPolicyCommandResult> {
    return this.runPolicyCommand('retire', { policyId }, commandKey);
  }

  async processPersonalDataRequest(
    requestId: string,
    decision: 'approve' | 'deny',
    reasonCategory: string,
    commandKey: string,
  ): Promise<WorkshopPersonalDataCommandResult> {
    const { data, error } = await this.supabase.getClient().rpc(
      'manage_workshop_personal_data',
      {
        p_action: 'process_request',
        p_payload: {
          requestId,
          decision,
          reasonCategory: reasonCategory.trim() || null,
        },
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as WorkshopPersonalDataCommandResult;
  }

  private async runPolicyCommand(
    action: string,
    payload: object,
    commandKey: string,
  ): Promise<WorkshopRetentionPolicyCommandResult> {
    const { data, error } = await this.supabase.getClient().rpc(
      'manage_workshop_data_retention_policy',
      {
        p_action: action,
        p_payload: payload,
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as WorkshopRetentionPolicyCommandResult;
  }
}
