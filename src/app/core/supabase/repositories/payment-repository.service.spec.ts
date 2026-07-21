import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '../clients/supabase.service';
import { PaymentRepositoryService } from './payment-repository.service';

describe('PaymentRepositoryService', () => {
  let service: PaymentRepositoryService;
  let supabase: jasmine.SpyObj<SupabaseService>;
  let rpc: jasmine.Spy;
  beforeEach(() => {
    rpc = jasmine.createSpy('rpc');
    supabase = jasmine.createSpyObj('SupabaseService', ['getClient']);
    supabase.getClient.and.returnValue({ rpc } as never);
    TestBed.configureTestingModule({ providers: [PaymentRepositoryService, { provide: SupabaseService, useValue: supabase }] });
    service = TestBed.inject(PaymentRepositoryService);
  });

  it('maps server pagination and preserves exact cents', async () => {
    rpc.and.resolveTo({ data: { rows: [{ target_amount: 123.45, credited_principal: 23.45, outstanding_amount: 100 }], total: 1, page: 2, pageSize: 25 }, error: null });
    const page = await service.listObligations({ search: 'Bloom', page: 2 });
    expect(rpc).toHaveBeenCalledWith('list_payment_obligations', jasmine.objectContaining({ p_search: 'Bloom', p_page: 2 }));
    expect(page.rows[0].outstanding_amount).toBe(100);
  });

  it('retains ordered histories returned by the database detail contract', async () => {
    rpc.and.resolveTo({ data: { obligation: {}, project: {}, requests: [], checkouts: [], intentions: [], transactions: [{ occurred_at: '2026-02-02' }, { occurred_at: '2026-01-01' }], deliveries: [], exceptions: [], legalHolds: [], activity: [] }, error: null });
    const detail = await service.getObligationDetail('obligation-1');
    expect(detail?.transactions.map((item) => item.occurred_at)).toEqual(['2026-02-02', '2026-01-01']);
  });
});
