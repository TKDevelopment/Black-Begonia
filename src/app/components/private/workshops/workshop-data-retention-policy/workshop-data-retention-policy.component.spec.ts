import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import {
  WorkshopDataRetentionPolicy,
  WorkshopPersonalDataRequest,
} from '../../../../core/models/workshop-booking';
import { WorkshopPrivacyRepositoryService } from '../../../../core/supabase/repositories/workshop-privacy-repository.service';
import {
  WorkshopDataRetentionPolicyComponent,
} from './workshop-data-retention-policy.component';

describe('WorkshopDataRetentionPolicyComponent', () => {
  let fixture: ComponentFixture<WorkshopDataRetentionPolicyComponent>;
  let component: WorkshopDataRetentionPolicyComponent;
  let privacy: jasmine.SpyObj<WorkshopPrivacyRepositoryService>;

  const policy = {
    workshop_data_retention_policy_id: 'policy-1',
    policy_version: '2026-01',
    state: 'approved',
    effective_at: '2026-07-01T00:00:00Z',
    field_rules: [],
    operational_retention_days: 365,
    communication_retention_days: 90,
    financial_retention_days: 2555,
    dispute_retention_days: 2555,
    audit_retention_days: 2555,
    approved_by: 'admin-1',
    approved_at: '2026-07-01T00:00:00Z',
    activated_by: null,
    activated_at: null,
    retired_by: null,
    retired_at: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  } satisfies WorkshopDataRetentionPolicy;
  const request = {
    workshop_personal_data_request_id: 'request-1',
    workshop_booking_id: 'booking-1',
    request_type: 'minimization',
    requested_field_categories: ['contact_email'],
    state: 'verified',
    verification_method: 'email_link',
    verification_expires_at: null,
    verified_at: '2026-07-30T00:00:00Z',
    replacement_email_expires_at: null,
    replacement_email_confirmed_at: null,
    retention_policy_version: null,
    processed_by: null,
    reason_category: null,
    earliest_eligible_at: null,
    created_at: '2026-07-30T00:00:00Z',
    updated_at: '2026-07-30T00:00:00Z',
    processed_at: null,
  } satisfies WorkshopPersonalDataRequest;

  beforeEach(async () => {
    privacy = jasmine.createSpyObj<WorkshopPrivacyRepositoryService>(
      'WorkshopPrivacyRepositoryService',
      [
        'listRetentionPolicies', 'listPersonalDataRequests', 'createPolicyDraft',
        'approvePolicy', 'activatePolicy', 'retirePolicy',
        'processPersonalDataRequest',
      ],
    );
    privacy.listRetentionPolicies.and.resolveTo([policy]);
    privacy.listPersonalDataRequests.and.resolveTo([request]);
    privacy.activatePolicy.and.resolveTo({
      replayed: false, policyId: 'policy-1', policyVersion: '2026-01', state: 'active',
    });
    privacy.createPolicyDraft.and.resolveTo({
      replayed: false, policyId: 'policy-2', policyVersion: '2026-02', state: 'draft',
    });
    privacy.approvePolicy.and.resolveTo({
      replayed: false, policyId: 'policy-1', policyVersion: '2026-01', state: 'approved',
    });
    privacy.retirePolicy.and.resolveTo({
      replayed: false, policyId: 'policy-1', policyVersion: '2026-01', state: 'retired',
    });
    privacy.processPersonalDataRequest.and.resolveTo({
      replayed: false,
      requestId: 'request-1',
      state: 'deferred',
      reasonCategory: 'active_customer_dependency',
      earliestEligibleAt: '2026-10-01T00:00:00Z',
    });
    spyOn(window, 'confirm').and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [WorkshopDataRetentionPolicyComponent],
      providers: [
        { provide: WorkshopPrivacyRepositoryService, useValue: privacy },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WorkshopDataRetentionPolicyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows the safe no-active-policy state and only enables verified processing', () => {
    expect(component.activePolicy()).toBeNull();
    expect(component.canProcess(request)).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('No active policy');
  });

  it('identifies CRM Settings and consumes the shared light and dark theme tokens', () => {
    const host = fixture.nativeElement as HTMLElement;
    host.style.setProperty('--crm-page-bg', '#0b0f14');
    host.style.setProperty('--crm-surface', '#12171d');
    host.style.setProperty('--crm-text', '#d7dce2');
    host.style.setProperty('--crm-text-strong', '#f7f8fa');
    host.style.setProperty('--crm-border', '#39424d');
    fixture.detectChanges();

    const page = host.querySelector('.policy-page') as HTMLElement;
    const section = host.querySelector('.policy-section') as HTMLElement;
    const heading = host.querySelector('h1') as HTMLElement;

    expect(host.textContent).toContain('CRM Settings');
    expect(host.querySelector('a[href="/admin/workshops"]')).toBeNull();
    expect(getComputedStyle(page).backgroundColor).toBe('rgb(11, 15, 20)');
    expect(getComputedStyle(section).backgroundColor).toBe('rgb(18, 23, 29)');
    expect(getComputedStyle(heading).color).toBe('rgb(247, 248, 250)');
  });

  it('requires explicit confirmation before policy activation', async () => {
    await component.activate(policy);
    expect(window.confirm).toHaveBeenCalled();
    expect(privacy.activatePolicy).toHaveBeenCalledWith(
      'policy-1', policy.effective_at!, jasmine.any(String),
    );
  });

  it('presents only a safe deferment reason and earliest eligibility', async () => {
    await component.process(request, 'approve');
    expect(component.notice()).toContain('required customer access');
    expect(component.notice()).not.toContain('guest@example');
  });

  it('distinguishes processable and terminal request states including replacement pending', () => {
    expect(component.canProcess({ ...request, state: 'pending_verification' }))
      .toBeFalse();
    expect(component.canProcess({ ...request, state: 'verified' })).toBeTrue();
    expect(component.canProcess({ ...request, state: 'deferred' })).toBeTrue();
    expect(component.canProcess({
      ...request,
      state: 'approved',
      replacement_email_expires_at: '2026-08-01T00:00:00Z',
    })).toBeFalse();
    expect(component.canProcess({ ...request, state: 'denied' })).toBeFalse();
    expect(component.canProcess({ ...request, state: 'completed' })).toBeFalse();
  });

  it('maps draft, approval, activation, and retirement through confirmed commands', async () => {
    component.policyVersion = '2026-02';
    await component.createDraft();
    await component.approve({ ...policy, state: 'draft' });
    await component.activate(policy);
    await component.retire({ ...policy, state: 'active' });

    expect(privacy.createPolicyDraft).toHaveBeenCalled();
    expect(privacy.approvePolicy).toHaveBeenCalledWith(
      'policy-1', jasmine.any(String),
    );
    expect(privacy.activatePolicy).toHaveBeenCalled();
    expect(privacy.retirePolicy).toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalled();
  });

  it('surfaces policy command errors without inventing a successful state', async () => {
    privacy.activatePolicy.and.rejectWith(new Error('activation unavailable'));

    await expectAsync(component.activate(policy))
      .toBeRejectedWithError('activation unavailable');
    expect(component.activePolicy()).toBeNull();
  });
});
