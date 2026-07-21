import { TestBed } from '@angular/core/testing';
import { createSupabaseClientWithQuery, supabaseSuccess } from '../../testing/supabase-testing';
import { SupabaseService } from '../clients/supabase.service';
import { ProjectPaymentRecordRepositoryService } from './project-payment-record-repository.service';

describe('ProjectPaymentRecordRepositoryService', () => {
  let service: ProjectPaymentRecordRepositoryService;
  let supabase: jasmine.SpyObj<SupabaseService>;
  beforeEach(() => {
    supabase = jasmine.createSpyObj('SupabaseService', ['getClient']);
    TestBed.configureTestingModule({ providers: [ProjectPaymentRecordRepositoryService, { provide: SupabaseService, useValue: supabase }] });
    service = TestBed.inject(ProjectPaymentRecordRepositoryService);
  });

  it('keeps zero distinct from unavailable in financial summary mapping', async () => {
    const rpc = jasmine.createSpy('rpc').and.resolveTo({ data: { available: true, proposalTotal: 0, depositTarget: 0, finalTarget: 0, creditedPrincipal: 0, outstanding: 0, customerFees: 0, merchantFees: null, overpayment: 0, obligations: [] }, error: null });
    supabase.getClient.and.returnValue({ rpc } as never);
    const summary = await service.getProjectFinancialSummary('project-1');
    expect(summary.available).toBeTrue();
    expect(summary.proposalTotal).toBe(0);
    expect(summary.merchantFees).toBeNull();
  });

  it('maps obligation aggregate fields without cents loss', async () => {
    const row = { project_payment_record_id: 'o1', project_id: 'p1', payment_kind: 'deposit', status: 'partially_paid', amount_due: 300.03, amount_paid: 100.01, target_amount: 300.03, credited_principal: 100.01, outstanding_amount: 200.02, payment_source: 'manual', created_at: '2026-01-01', updated_at: '2026-01-01' };
    const { client } = createSupabaseClientWithQuery(supabaseSuccess([row]));
    supabase.getClient.and.returnValue(client as never);
    const rows = await service.getProjectPaymentRecords('p1');
    expect(rows[0].outstanding_amount).toBe(200.02);
  });
});
