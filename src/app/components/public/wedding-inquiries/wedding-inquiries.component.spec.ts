import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { SupabaseService } from '../../../core/supabase/clients/supabase.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { WeddingInquiriesComponent } from './wedding-inquiries.component';

describe('WeddingInquiriesComponent', () => {
  let component: WeddingInquiriesComponent;
  let fixture: ComponentFixture<WeddingInquiriesComponent>;
  let leadRepository: jasmine.SpyObj<LeadRepositoryService>;
  let supabase: jasmine.SpyObj<SupabaseService>;
  let toast: jasmine.SpyObj<ToastService>;
  let router: jasmine.SpyObj<Router>;
  let seo: jasmine.SpyObj<SeoService>;
  let invoke: jasmine.Spy;
  let insert: jasmine.Spy;

  beforeEach(async () => {
    leadRepository = jasmine.createSpyObj<LeadRepositoryService>(
      'LeadRepositoryService',
      ['createWeddingLead'],
    );
    invoke = jasmine.createSpy('invoke').and.resolveTo({ data: { success: true }, error: null });
    insert = jasmine.createSpy('insert').and.resolveTo({ data: null, error: null });
    supabase = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    supabase.getClient.and.returnValue({
      from: jasmine.createSpy('from').and.returnValue({ insert }),
      functions: { invoke },
    } as any);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['showToast']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    seo = jasmine.createSpyObj<SeoService>('SeoService', ['setPageMeta']);

    await TestBed.configureTestingModule({
      imports: [WeddingInquiriesComponent],
      providers: [
        { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: SupabaseService, useValue: supabase },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: SeoService, useValue: seo },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeddingInquiriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should configure SEO metadata on init', () => {
    expect(seo.setPageMeta).toHaveBeenCalledWith(
      jasmine.objectContaining({
        title: 'Wedding Inquiry | Black Begonia Florals',
        url: 'https://blackbegoniaflorals.com/inquiries/weddings',
      }),
    );
  });

  it('should mark required controls and show tooltips when submitted invalid', async () => {
    await component.onSubmit();

    expect(component.weddingInquiryForm.touched).toBeTrue();
    expect(component.invalidTooltips['firstName']).toBe('visible');
    expect(leadRepository.createWeddingLead).not.toHaveBeenCalled();
    expect(component.submitting).toBeFalse();
  });

  it('should reset an incompatible budget when service type changes', () => {
    component.weddingInquiryForm.patchValue({
      serviceType: 'wedding-full-service',
      budget: '$3,000 - $5,000',
    });

    component.weddingInquiryForm.get('serviceType')?.setValue('engagement');

    expect(component.weddingInquiryForm.get('budget')?.value).toBe('');
    expect(component.budgetOptions.map((option) => option.value)).toContain('$350 - $500');
  });

  it('should create a wedding lead, save inspiration URLs, send emails, and navigate', async () => {
    leadRepository.createWeddingLead.and.resolveTo({ lead_id: 'lead-wedding-1' } as any);
    component.weddingInquiryForm.patchValue({
      firstName: 'Avery',
      lastName: 'Bloom',
      fianceFirstName: 'Jordan',
      fianceLastName: 'Reed',
      phone: '555-010-1000',
      email: 'avery.bloom@example.com',
      eventDate: '2026-10-24',
      serviceType: 'wedding-full-service',
      ceremonyVenue: 'Test Garden',
      receptionVenue: 'Test Hall',
      budget: '$3,000 - $5,000',
      guests: 80,
      preferredContactMethod: 'email',
      leadSource: '',
      notes: 'Garden inspired ceremony florals.',
    });
    component.inspirationUrls.at(0).setValue('https://example.test/wedding');

    await component.onSubmit();

    expect(leadRepository.createWeddingLead).toHaveBeenCalledWith(
      jasmine.objectContaining({
        event_type: 'wedding',
        first_name: 'Avery',
        partner_first_name: 'Jordan',
        source: 'other',
        guest_count: 80,
      }),
    );
    expect(insert).toHaveBeenCalledWith([
      { lead_id: 'lead-wedding-1', url: 'https://example.test/wedding' },
    ]);
    expect(invoke).toHaveBeenCalledWith('send-inquiry-emails', {
      body: { lead_id: 'lead-wedding-1', lead_type: 'wedding' },
    });
    expect(toast.showToast).toHaveBeenCalledWith(
      'Your wedding inquiry has been submitted successfully!',
      'success',
    );
    expect(router.navigate).toHaveBeenCalledWith(['/inquiries/success']);
    expect(component.submitted).toBeTrue();
    expect(component.submitting).toBeFalse();
  });

  it('should show an error toast when wedding lead creation fails', async () => {
    leadRepository.createWeddingLead.and.rejectWith({ status: 401 });
    component.weddingInquiryForm.patchValue({
      firstName: 'Avery',
      lastName: 'Bloom',
      fianceFirstName: 'Jordan',
      fianceLastName: 'Reed',
      phone: '555-010-1000',
      email: 'avery.bloom@example.com',
      eventDate: '2026-10-24',
      serviceType: 'wedding-full-service',
      budget: '$3,000 - $5,000',
      preferredContactMethod: 'email',
    });

    await component.onSubmit();

    expect(toast.showToast).toHaveBeenCalledWith(
      'Failed to submit your wedding inquiry. Please try again later.',
      'error',
    );
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.submitting).toBeFalse();
  });
});
