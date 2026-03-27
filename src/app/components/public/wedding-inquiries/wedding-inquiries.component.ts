import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SupabaseService } from '../../../core/supabase/clients/supabase.service';
import { CreateWeddingLeadInput } from '../../../core/models/create-wedding-lead-input';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { Router } from '@angular/router';

type WeddingServiceType =
  | 'full-service wedding'
  | 'ceremony-only wedding'
  | 'elopement'
  | 'engagement';

type BudgetOption = {
  label: string;
  value: string;
};

@Component({
  selector: 'app-wedding-inquiries',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './wedding-inquiries.component.html',
  styleUrl: './wedding-inquiries.component.scss',
})
export class WeddingInquiriesComponent {
  private readonly inquiryEmailMaxAttempts = 3;
  private readonly inquiryEmailRetryDelayMs = 1200;
  private readonly weddingBudgetOptions: Record<WeddingServiceType, BudgetOption[]> = {
    'full-service wedding': [
      { label: '$3,000 - $5,000', value: '$3,000 - $5,000' },
      { label: '$5,000 - $8,000', value: '$5,000 - $8,000' },
      { label: '$8,000 - $10,000', value: '$8,000 - $10,000' },
      { label: '$10,000+', value: '$10,000+' },
    ],
    'ceremony-only wedding': [
      { label: '$2,800 - $5,000', value: '$2,800 - $5,000' },
      { label: '$5,000 - $8,000', value: '$5,000 - $8,000' },
      { label: '$8,000 - $10,000', value: '$8,000 - $10,000' },
      { label: '$10,000+', value: '$10,000+' },
    ],
    engagement: [
      { label: '$350 - $500', value: '$350 - $500' },
      { label: '$500 - $800', value: '$500 - $800' },
      { label: '$800 - $1,200', value: '$800 - $1,200' },
      { label: '$1,200+', value: '$1,200+' },
    ],
    elopement: [
      { label: '$650 - $1,000', value: '$650 - $1,000' },
      { label: '$1,000 - $1,500', value: '$1,000 - $1,500' },
      { label: '$1,500 - $2,000', value: '$1,500 - $2,000' },
      { label: '$2,000+', value: '$2,000+' },
    ],
  };
  weddingInquiryForm!: FormGroup;
  submitting = false;
  submitted = false;
  error: string | null = null;
  submittedInquiry: { lead_id: string } | null = null;
  invalidTooltips: Record<string, 'hidden' | 'visible' | 'fading'> = {};
  private tooltipTimers: Record<string, any> = {};

  constructor(
    private fb: FormBuilder,
    private supabase: SupabaseService,
    private toast: ToastService,
    private seo: SeoService,
    private leadRepository: LeadRepositoryService,
    private router: Router
  ) {
    this.weddingInquiryForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/), Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/), Validators.minLength(2)]],
      fianceFirstName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/), Validators.minLength(2)]],
      fianceLastName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/), Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^(\+1\s?)?(\(?\d{3}\)?)[-\s.]?\d{3}[-\s.]?\d{4}$/)]],
      email: ['', [Validators.required, Validators.email]],
      eventDate: ['', Validators.required],
      serviceType: ['', Validators.required],
      ceremonyVenue: [''],
      receptionVenue: [''],
      budget: ['', Validators.required],
      guests: [''],
      eventPlannerName: [''],
      eventPlannerPhone: ['', Validators.pattern(/^(\+1\s?)?(\(?\d{3}\)?)[-\s.]?\d{3}[-\s.]?\d{4}$/)],
      eventPlannerEmail: ['', Validators.email],
      preferredContactMethod: ['', Validators.required],
      leadSource: [''],
      notes: ['', Validators.maxLength(500)],
      inspirationUrls: this.fb.array([]),
    });

    this.requiredControlNames().forEach((name) => {
      this.invalidTooltips[name] = 'hidden';
    });

    this.weddingInquiryForm.get('serviceType')?.valueChanges.subscribe((serviceType) => {
      const budgetControl = this.weddingInquiryForm.get('budget');
      if (!budgetControl) return;

      const allowedValues = this.getBudgetOptionsForServiceType(serviceType).map(
        (option) => option.value
      );

      if (budgetControl.value && !allowedValues.includes(budgetControl.value)) {
        budgetControl.setValue('');
      }
    });

    this.addInspirationUrl();
  }

  get budgetOptions(): BudgetOption[] {
    return this.getBudgetOptionsForServiceType(
      this.weddingInquiryForm.get('serviceType')?.value
    );
  }

  get inspirationUrls(): FormArray {
    return this.weddingInquiryForm.get('inspirationUrls') as FormArray;
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
      'fianceFirstName',
      'fianceLastName',
      'phone',
      'email',
      'eventDate',
      'serviceType',
      'budget',
      'preferredContactMethod',
    ];
  }

  private showInvalidTooltips(): void {
    const names = this.requiredControlNames();

    names.forEach((name) => {
      const ctrl = this.weddingInquiryForm.get(name);
      if (!ctrl) return;

      const isInvalid = ctrl.invalid;

      if (isInvalid) {
        this.invalidTooltips[name] = 'visible';

        if (this.tooltipTimers[name]) clearTimeout(this.tooltipTimers[name]);

        // after 3 seconds → start fade out
        this.tooltipTimers[name] = setTimeout(() => {
          this.invalidTooltips[name] = 'fading';

          // remove from DOM after fade-out finishes
          setTimeout(() => {
            this.invalidTooltips[name] = 'hidden';
          }, 400); // must match fadeOut duration
        }, 3000);
      } else {
        this.invalidTooltips[name] = 'hidden';
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.weddingInquiryForm.invalid) {
      this.weddingInquiryForm.markAllAsTouched();
      this.showInvalidTooltips();
      return;
    }

    this.submitting = true;
    this.submitted = false;
    this.error = null;
    this.submittedInquiry = null;

    try {
      const { value } = this.weddingInquiryForm;

      const payload: CreateWeddingLeadInput = {
        event_type: 'wedding',
        first_name: value.firstName,
        last_name: value.lastName,
        partner_first_name: value.fianceFirstName,
        partner_last_name: value.fianceLastName,
        email: value.email,
        phone: value.phone,
        preferred_contact_method: value.preferredContactMethod,
        event_date: value.eventDate || null,
        service_type: value.serviceType,
        ceremony_venue_name: (value.ceremonyVenue ?? '').trim() || null,
        reception_venue_name: (value.receptionVenue ?? '').trim() || null,
        budget_range: value.budget || null,
        guest_count: value.guests ? Number(value.guests) : null,
        inquiry_message: value.notes || null,
        planner_name: value.eventPlannerName || null,
        planner_phone: value.eventPlannerPhone || null,
        planner_email: value.eventPlannerEmail || null,
        source: value.leadSource || 'other',
      };

      const lead = await this.leadRepository.createWeddingLead(payload);

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

      await this.triggerInquiryEmails(lead.lead_id, 'wedding');

      this.submittedInquiry = { lead_id: lead.lead_id };
      this.submitted = true;

      this.weddingInquiryForm.reset({
        leadSource: 'other',
      });

      this.requiredControlNames().forEach((name) => {
        this.invalidTooltips[name] = 'hidden';
      });

      this.inspirationUrls.clear();
      this.addInspirationUrl();

      this.toast.showToast(
        'Your wedding inquiry has been submitted successfully!',
        'success'
      );

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
        console.error(
          'An error occurred while submitting your inquiry. Please try again later.'
        );
      }

      this.toast.showToast(
        'Failed to submit your wedding inquiry. Please try again later.',
        'error'
      );
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

  private getBudgetOptionsForServiceType(serviceType: string | null | undefined): BudgetOption[] {
    const normalizedServiceType = String(serviceType ?? '').trim().toLowerCase() as WeddingServiceType;

    return (
      this.weddingBudgetOptions[normalizedServiceType] ??
      this.weddingBudgetOptions['full-service wedding']
    );
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}
