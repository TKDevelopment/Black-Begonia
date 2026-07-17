import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { SupabaseService } from '../../../core/supabase/clients/supabase.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { GeneralInquiriesComponent } from './general-inquiries.component';

describe('GeneralInquiriesComponent', () => {
  let component: GeneralInquiriesComponent;
  let fixture: ComponentFixture<GeneralInquiriesComponent>;
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
      ['createGeneralLead'],
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
      imports: [GeneralInquiriesComponent],
      providers: [
        { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: SupabaseService, useValue: supabase },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: SeoService, useValue: seo },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeneralInquiriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should configure SEO metadata on init', () => {
    expect(seo.setPageMeta).toHaveBeenCalledWith(
      jasmine.objectContaining({
        title: 'General Floral Inquiry | Black Begonia Florals',
        url: 'https://blackbegoniaflorals.com/inquiries/general',
      }),
    );
  });

  it('should mark required controls and show tooltips when submitted invalid', async () => {
    await component.onSubmit();

    expect(component.generalInquiryForm.touched).toBeTrue();
    expect(component.invalidTooltips['firstName']).toBe('visible');
    expect(leadRepository.createGeneralLead).not.toHaveBeenCalled();
    expect(component.submitting).toBeFalse();
  });

  it('should create a general lead, save unique inspiration URLs, send emails, and navigate', async () => {
    leadRepository.createGeneralLead.and.resolveTo({ lead_id: 'lead-general-1' } as any);
    component.generalInquiryForm.patchValue({
      firstName: 'Morgan',
      lastName: 'Petal',
      phone: '555-010-1000',
      email: 'morgan.petal@example.com',
      serviceType: 'baby-shower',
      eventDate: '2026-09-12',
      preferredContactMethod: 'email',
      leadSource: '',
      notes: 'Please make it bright.',
    });
    component.inspirationUrls.at(0).setValue('https://example.test/inspo');
    component.addInspirationUrl();
    component.inspirationUrls.at(1).setValue('https://example.test/inspo');

    await component.onSubmit();

    expect(leadRepository.createGeneralLead).toHaveBeenCalledWith(
      jasmine.objectContaining({
        event_type: 'general',
        first_name: 'Morgan',
        last_name: 'Petal',
        source: 'other',
        inquiry_message: 'Please make it bright.',
      }),
    );
    expect(insert).toHaveBeenCalledWith([
      { lead_id: 'lead-general-1', url: 'https://example.test/inspo' },
    ]);
    expect(invoke).toHaveBeenCalledWith('send-inquiry-emails', {
      body: { lead_id: 'lead-general-1', lead_type: 'general' },
    });
    expect(toast.showToast).toHaveBeenCalledWith(
      'Your inquiry has been submitted successfully!',
      'success',
    );
    expect(router.navigate).toHaveBeenCalledWith(['/inquiries/success']);
    expect(component.submitted).toBeTrue();
    expect(component.submitting).toBeFalse();
  });

  it('should show an error toast when lead creation fails', async () => {
    leadRepository.createGeneralLead.and.rejectWith({ message: 'insert failed' });
    component.generalInquiryForm.patchValue({
      firstName: 'Morgan',
      lastName: 'Petal',
      phone: '555-010-1000',
      email: 'morgan.petal@example.com',
      serviceType: 'baby-shower',
      preferredContactMethod: 'email',
    });

    await component.onSubmit();

    expect(toast.showToast).toHaveBeenCalledWith(
      'Failed to submit your inquiry. Please try again later.',
      'error',
    );
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.submitting).toBeFalse();
  });
});
