import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '../clients/supabase.service';
import { CustomerPaymentService } from './customer-payment.service';

describe('CustomerPaymentService', () => {
  let service: CustomerPaymentService;
  let invoke: jasmine.Spy;
  beforeEach(() => {
    invoke = jasmine.createSpy('invoke');
    TestBed.configureTestingModule({ providers: [CustomerPaymentService, { provide: SupabaseService, useValue: { getClient: () => ({ functions: { invoke } }) } }] });
    service = TestBed.inject(CustomerPaymentService);
  });
  it('maps the minimal authoritative projection to numeric cents', async () => {
    invoke.and.resolveTo({ data: { state:'active',principalCents:'30000',depositCents:'30000',finalCents:'0',methods:['cash'] }, error:null });
    const result=await service.resolve('opaque-token');
    expect(result).toEqual(jasmine.objectContaining({state:'active',principalCents:30000,depositCents:30000}));
    expect(invoke).toHaveBeenCalledWith('resolve-payment-request',{body:{token:'opaque-token',attempt:null}});
  });
  it('uses one generic unavailable state for malformed and failed responses', async () => {
    invoke.and.resolveTo({data:{state:'confirmed',token:'must-not-map'},error:{message:'denied'}});
    expect(await service.resolve('bad')).toEqual({state:'unavailable'});
    invoke.and.resolveTo({data:{state:'browser_says_paid'},error:null});
    expect(await service.resolve('bad')).toEqual({state:'unavailable'});
  });
  it('passes only token and method to checkout and propagates method locks', async () => {
    invoke.and.resolveTo({data:null,error:{message:'PAYMENT_METHOD_LOCKED'}});
    await expectAsync(service.choose('token','check')).toBeRejectedWithError('PAYMENT_METHOD_LOCKED');
    expect(invoke).toHaveBeenCalledWith('create-payment-checkout',{body:{token:'token',method:'check'}});
  });
  it('polls until the server reports confirmed', async () => {
    spyOn(service,'resolve').and.returnValues(Promise.resolve({state:'processing'}),Promise.resolve({state:'confirmed'}));
    expect((await service.poll('token','attempt',3,0)).state).toBe('confirmed');
  });
  it('maps direct Venmo instructions without invoking a capture endpoint', async () => {
    invoke.and.resolveTo({data:{kind:'manual_venmo',approvedTarget:'https://venmo.com/u/black-begonia',reference:'BB-PROJECT-1',amountCents:30000,pauseEndsAt:'2026-08-01T00:00:00Z'},error:null});
    await expectAsync(service.choose('token','venmo')).toBeResolvedTo(jasmine.objectContaining({kind:'manual_venmo',pauseEndsAt:'2026-08-01T00:00:00Z'}));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('create-payment-checkout',{body:{token:'token',method:'venmo'}});
  });
});
