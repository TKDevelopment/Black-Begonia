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
  it('loads the PayPal SDK lazily once with Venmo funding enabled', async () => {
    const append=spyOn(document.head,'appendChild').and.callFake(((node:Node)=>{setTimeout(()=>((node as HTMLScriptElement).onload as any)?.(new Event('load')));return node;}) as any);
    const first=service.loadPayPalSdk('public-client');const second=service.loadPayPalSdk('public-client');
    expect(first).toBe(second);await first;
    const script=append.calls.mostRecent().args[0] as HTMLScriptElement;
    expect(script.src).toContain('client-id=public-client');expect(script.src).toContain('enable-funding=venmo');
  });
});
