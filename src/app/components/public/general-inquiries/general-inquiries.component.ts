import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SupabaseService } from '../../../core/supabase/clients/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/seo/seo.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { CreateGeneralLeadInput } from '../../../core/models/create-general-lead-input';
import { Router } from '@angular/router';

@Component({
  selector: 'app-general-inquiries',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './general-inquiries.component.html',
  styleUrl: './general-inquiries.component.scss',
})
export class GeneralInquiriesComponent implements OnInit {
  private readonly inquiryEmailMaxAttempts = 3;
  private readonly inquiryEmailRetryDelayMs = 1200;
  generalInquiryForm!: FormGroup;
  submitting = false;
  submitted = false;
  error: string | null = null;
  submittedInquiry: { lead_id: string } | null = null;
  invalidTooltips: Record<string, 'hidden' | 'visible' | 'fading'> = {};
  private tooltipTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  constructor(
    private fb: FormBuilder,
    private supabase: SupabaseService,
    private leadRepository: LeadRepositoryService,
    private toast: ToastService,
    private router: Router,
    private seo: SeoService
  ) {
    this.generalInquiryForm = this.fb.group({
      firstName: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[a-zA-Z]+(?:[ '-][a-zA-Z]+)*$/),
          Validators.minLength(2),
        ],
      ],
      lastName: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[a-zA-Z]+(?:[ '-][a-zA-Z]+)*$/),
          Validators.minLength(2),
        ],
      ],
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(/^(\+1\s?)?(\(?\d{3}\)?)[-\s.]?\d{3}[-\s.]?\d{4}$/),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
      serviceType: ['', Validators.required],
      eventDate: [''],
      preferredContactMethod: ['', Validators.required],
      leadSource: [''],
      notes: ['', Validators.maxLength(500)],
      inspirationUrls: this.fb.array([]),
    });

    this.requiredControlNames().forEach((name) => {
      this.invalidTooltips[name] = 'hidden';
    });

    this.addInspirationUrl();
  }

  ngOnInit(): void {
    this.seo.setPageMeta({
      title: 'General Floral Inquiry | Black Begonia Florals',
      description:
        'Reach out to Black Begonia Florals for event flowers, sympathy flowers, subscriptions, and custom floral design inquiries.',
      url: 'https://blackbegoniaflorals.com/inquiries/general',
      image: 'https://blackbegoniaflorals.com/assets/images/og-default.png',
      keywords: [
        'General floral inquiry',
        'Event florist inquiry',
        'Rhode Island florist',
        'Custom flower arrangements',
      ],
    });
  }

  get inspirationUrls(): FormArray {
    return this.generalInquiryForm.get('inspirationUrls') as FormArray;
  }

  addInspirationUrl(): void {
    this.inspirationUrls.push(
      this.fb.control('', [Validators.pattern(/^(https?:\/\/).+/i)])
    );
  }

  removeInspirationUrl(index: number): void {
    this.inspirationUrls.removeAt(index);
  }

  private getCleanInspirationUrls(): string[] {
    const urls = (this.inspirationUrls.value as string[])
      .map((u) => (u ?? '').trim())
      .filter((u) => u.length > 0);

    return Array.from(new Set(urls));
  }

  private requiredControlNames(): string[] {
    return [
      'firstName',
      'lastName',
      'phone',
      'email',
      'serviceType',
      'preferredContactMethod',
    ];
  }

  private showInvalidTooltips(): void {
    const names = this.requiredControlNames();

    names.forEach((name) => {
      const ctrl = this.generalInquiryForm.get(name);
      if (!ctrl) return;

      if (ctrl.invalid) {
        this.invalidTooltips[name] = 'visible';

        if (this.tooltipTimers[name]) clearTimeout(this.tooltipTimers[name]);

        this.tooltipTimers[name] = setTimeout(() => {
          this.invalidTooltips[name] = 'fading';

          setTimeout(() => {
            this.invalidTooltips[name] = 'hidden';
          }, 400);
        }, 3000);
      } else {
        this.invalidTooltips[name] = 'hidden';
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.generalInquiryForm.invalid) {
      this.generalInquiryForm.markAllAsTouched();
      this.showInvalidTooltips();
      return;
    }

    this.submitting = true;
    this.submitted = false;
    this.error = null;
    this.submittedInquiry = null;

    try {
      const { value } = this.generalInquiryForm;

      const payload: CreateGeneralLeadInput = {
        service_type: value.serviceType,
        event_type: 'general',
        first_name: value.firstName,
        last_name: value.lastName,
        email: value.email,
        phone: value.phone,
        preferred_contact_method: value.preferredContactMethod,
        event_date: value.eventDate || null,
        inquiry_message: value.notes || null,
        source: value.leadSource || 'other',
      };

      const lead = await this.leadRepository.createGeneralLead(payload);

      const urls = this.getCleanInspirationUrls();

      if (urls.length > 0) {
        const rows = urls.map((u) => ({
          lead_id: lead.lead_id,
          url: u,
        }));

        const { error: urlError } = await this.supabase
          .getClient()
          .from('lead_inspiration_urls')
          .insert(rows);

        if (urlError) {
          console.error('[lead_inspiration_urls] insert error:', urlError);
          this.toast.showToast(
            'Inquiry submitted, but we could not save your inspiration links.',
            'error'
          );
        }
      }

      await this.triggerInquiryEmails(lead.lead_id, 'general');

      this.submittedInquiry = { lead_id: lead.lead_id };
      this.submitted = true;

      this.generalInquiryForm.reset({
        leadSource: 'other',
      });

      this.requiredControlNames().forEach((name) => {
        this.invalidTooltips[name] = 'hidden';
      });

      this.inspirationUrls.clear();
      this.addInspirationUrl();

      this.toast.showToast('Your inquiry has been submitted successfully!', 'success');
      this.router.navigate(['/inquiries/success']);
    } catch (err: any) {
      console.error('Supabase insert error:', err);

      if (err?.code === '42501') {
        console.error(
          'Your submission was blocked by database security rules (RLS). Please contact support.'
        );
      } else if (err?.message?.includes('Unauthorized') || err?.status === 401) {
        console.error('Request was unauthorized. Please refresh and try again.');
      } else {
        console.error('An error occurred while submitting your inquiry. Please try again later.');
      }

      this.toast.showToast('Failed to submit your inquiry. Please try again later.', 'error');
    } finally {
      this.submitting = false;      
    }
  }

  async triggerInquiryEmails(leadId: string, leadType: string) {
    const client = this.supabase.getClient();
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= this.inquiryEmailMaxAttempts; attempt += 1) {
      try {
        const { data, error } = await client.functions.invoke('send-inquiry-emails', {
          body: {
            lead_id: leadId,
            lead_type: leadType,
          },
        });

        if (error) {
          throw error;
        }

        if (data?.success === false) {
          throw new Error(
            typeof data?.error === 'string'
              ? data.error
              : 'Inquiry email function reported failure.'
          );
        }

        console.log('[send-inquiry-emails] response:', data);
        return;
      } catch (error) {
        lastError = error;
        console.error(
          `[send-inquiry-emails] attempt ${attempt}/${this.inquiryEmailMaxAttempts} failed:`,
          error
        );

        if (attempt < this.inquiryEmailMaxAttempts) {
          await this.delay(this.inquiryEmailRetryDelayMs);
        }
      }
    }

    console.error(
      `[send-inquiry-emails] all ${this.inquiryEmailMaxAttempts} attempts failed for lead ${leadId}.`,
      lastError
    );
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}
