import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  WorkshopDataRetentionPolicy,
  WorkshopPersonalDataRequest,
  WorkshopRetentionFieldRule,
} from '../../../../core/models/workshop-booking';
import { WorkshopPrivacyRepositoryService } from '../../../../core/supabase/repositories/workshop-privacy-repository.service';

@Component({
  selector: 'app-workshop-data-retention-policy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workshop-data-retention-policy.component.html',
  styleUrl: './workshop-data-retention-policy.component.scss',
})
export class WorkshopDataRetentionPolicyComponent implements OnInit {
  private readonly privacy = inject(WorkshopPrivacyRepositoryService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly policies = signal<WorkshopDataRetentionPolicy[]>([]);
  readonly requests = signal<WorkshopPersonalDataRequest[]>([]);
  readonly activePolicy = computed(() =>
    this.policies().find((policy) => policy.state === 'active') ?? null);

  policyVersion = '';
  effectiveAt = '';
  operationalRetentionDays = 365;
  communicationRetentionDays = 90;
  financialRetentionDays = 2555;
  disputeRetentionDays = 2555;
  auditRetentionDays = 2555;

  readonly defaultRules: WorkshopRetentionFieldRule[] = [
    {
      fieldCategory: 'contact_email',
      permittedActions: ['correct', 'minimize', 'retain'],
      minimumAgeDays: 30,
      prerequisites: ['no_active_customer_dependency'],
    },
    {
      fieldCategory: 'contact_phone',
      permittedActions: ['correct', 'minimize'],
      minimumAgeDays: 0,
      prerequisites: [],
    },
    {
      fieldCategory: 'attendee_name',
      permittedActions: ['correct', 'minimize'],
      minimumAgeDays: 0,
      prerequisites: [],
    },
    {
      fieldCategory: 'accommodation_details',
      permittedActions: ['correct', 'minimize'],
      minimumAgeDays: 0,
      prerequisites: [],
    },
  ];

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [policies, requests] = await Promise.all([
        this.privacy.listRetentionPolicies(),
        this.privacy.listPersonalDataRequests(),
      ]);
      this.policies.set(policies);
      this.requests.set(requests);
    } catch {
      this.error.set('We could not load workshop privacy administration.');
    } finally {
      this.loading.set(false);
    }
  }

  async createDraft(): Promise<void> {
    await this.privacy.createPolicyDraft({
      policyVersion: this.policyVersion,
      fieldRules: this.defaultRules,
      operationalRetentionDays: this.operationalRetentionDays,
      communicationRetentionDays: this.communicationRetentionDays,
      financialRetentionDays: this.financialRetentionDays,
      disputeRetentionDays: this.disputeRetentionDays,
      auditRetentionDays: this.auditRetentionDays,
    }, crypto.randomUUID());
    this.notice.set('Draft policy created for review.');
    await this.load();
  }

  async approve(policy: WorkshopDataRetentionPolicy): Promise<void> {
    if (!window.confirm(`Approve immutable policy ${policy.policy_version}?`)) return;
    await this.privacy.approvePolicy(
      policy.workshop_data_retention_policy_id,
      crypto.randomUUID(),
    );
    this.notice.set('Policy approved. Its content is now immutable.');
    await this.load();
  }

  async activate(policy: WorkshopDataRetentionPolicy): Promise<void> {
    if (!window.confirm(
      `Activate ${policy.policy_version} and retire the current active policy?`,
    )) return;
    await this.privacy.activatePolicy(
      policy.workshop_data_retention_policy_id,
      this.effectiveAt || policy.effective_at || new Date().toISOString(),
      crypto.randomUUID(),
    );
    this.notice.set('Policy activated and the prior active version retired.');
    await this.load();
  }

  async retire(policy: WorkshopDataRetentionPolicy): Promise<void> {
    if (!window.confirm(`Retire active policy ${policy.policy_version}?`)) return;
    await this.privacy.retirePolicy(
      policy.workshop_data_retention_policy_id,
      crypto.randomUUID(),
    );
    this.notice.set('Policy retired.');
    await this.load();
  }

  async process(
    request: WorkshopPersonalDataRequest,
    decision: 'approve' | 'deny',
  ): Promise<void> {
    const description = decision === 'approve' ? 'process' : 'deny';
    if (!window.confirm(`${description} this verified ${request.request_type} request?`)) {
      return;
    }
    const result = await this.privacy.processPersonalDataRequest(
      request.workshop_personal_data_request_id,
      decision,
      decision === 'deny' ? 'request_denied' : '',
      crypto.randomUUID(),
    );
    this.notice.set(
      result.state === 'deferred'
        ? `Request deferred: ${safeReason(result.reasonCategory)}${
          result.earliestEligibleAt
            ? ` until ${new Date(result.earliestEligibleAt).toLocaleString()}`
            : ''
        }.`
        : `Request result: ${result.state}.`,
    );
    await this.load();
  }

  canProcess(request: WorkshopPersonalDataRequest): boolean {
    return ['verified', 'deferred'].includes(request.state);
  }
}

function safeReason(reason: string | null | undefined): string {
  const reasons: Record<string, string> = {
    active_customer_dependency: 'required customer access or operational work remains active',
    request_denied: 'the request was denied under the active policy',
  };
  return reasons[reason ?? ''] ?? 'the active retention policy requires review';
}
