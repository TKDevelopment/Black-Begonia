import { TestBed } from '@angular/core/testing';

import { SupabaseService } from '../clients/supabase.service';
import { WorkshopPrivacyRepositoryService } from './workshop-privacy-repository.service';

describe('WorkshopPrivacyRepositoryService', () => {
  let service: WorkshopPrivacyRepositoryService;
  let rpc: jasmine.Spy;

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc');
    const supabase = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    supabase.getClient.and.returnValue({ rpc } as never);
    TestBed.configureTestingModule({
      providers: [
        WorkshopPrivacyRepositoryService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(WorkshopPrivacyRepositoryService);
  });

  it('maps draft creation to the admin-only policy command', async () => {
    rpc.and.resolveTo({
      data: { replayed: false, policyId: 'policy-1', policyVersion: '2026-01', state: 'draft' },
      error: null,
    });
    await service.createPolicyDraft({
      policyVersion: ' 2026-01 ',
      fieldRules: [],
      operationalRetentionDays: 365,
      communicationRetentionDays: 90,
      financialRetentionDays: 2555,
      disputeRetentionDays: 2555,
      auditRetentionDays: 2555,
    }, 'command-1');

    expect(rpc).toHaveBeenCalledWith('manage_workshop_data_retention_policy', {
      p_action: 'create_draft',
      p_payload: jasmine.objectContaining({ policyVersion: '2026-01' }),
      p_command_key: 'command-1',
    });
  });

  it('uses explicit review lifecycle commands instead of direct table mutation', async () => {
    rpc.and.resolveTo({ data: { replayed: false, policyId: 'policy-1' }, error: null });

    await service.approvePolicy('policy-1', 'command-approve');
    await service.activatePolicy('policy-1', '2026-08-01T00:00:00Z', 'command-activate');
    await service.retirePolicy('policy-1', 'command-retire');

    expect(rpc.calls.allArgs().map((call) => call[1].p_action))
      .toEqual(['approve', 'activate', 'retire']);
    expect(rpc.calls.argsFor(1)[1].p_payload).toEqual({
      policyId: 'policy-1',
      effectiveAt: '2026-08-01T00:00:00Z',
      confirmed: true,
    });
  });

  it('does not rewrite authorization or lifecycle errors', async () => {
    const error = { code: '42501', message: 'not authorized' };
    rpc.and.resolveTo({ data: null, error });

    await expectAsync(service.retirePolicy('policy-1', 'command'))
      .toBeRejectedWith(error);
  });

  it('processes verified correction or minimization through one authoritative command', async () => {
    rpc.and.resolveTo({
      data: {
        replayed: false,
        requestId: 'request-1',
        state: 'deferred',
        reasonCategory: 'active_customer_dependency',
        earliestEligibleAt: '2026-10-01T00:00:00Z',
      },
      error: null,
    });

    await expectAsync(service.processPersonalDataRequest(
      'request-1',
      'approve',
      ' active_customer_dependency ',
      'command-process',
    )).toBeResolvedTo(jasmine.objectContaining({
      state: 'deferred',
      reasonCategory: 'active_customer_dependency',
    }));
    expect(rpc).toHaveBeenCalledWith('manage_workshop_personal_data', {
      p_action: 'process_request',
      p_payload: {
        requestId: 'request-1',
        decision: 'approve',
        reasonCategory: 'active_customer_dependency',
      },
      p_command_key: 'command-process',
    });
  });
});
