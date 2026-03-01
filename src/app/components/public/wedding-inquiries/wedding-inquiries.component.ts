import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ToastService } from '../../../services/toast.service';
import { SeoService } from '../../../seo/seo.service';
import { SupabaseService } from '../../../services/supabase.service';

type InquiryInsert = {
  inquiry_id: string;
  first_name: string;
  last_name: string;
  fiance_first_name: string;
  fiance_last_name: string;
  phone: string;
  email: string;
  service_type: 'wedding';
  event_date: string;
  ceremony_venue: string | null;
  reception_venue: string | null;
  budget: number | string;
  guests: number | string;
  event_planner_name: string | null;
  event_planner_phone: string | null;
  event_planner_email: string | null;
  preferred_contact_method: string;
  lead_source: string;
  notes: string;
};

@Component({
  selector: 'app-wedding-inquiries',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './wedding-inquiries.component.html',
  styleUrl: './wedding-inquiries.component.scss',
})
export class WeddingInquiriesComponent {
  weddingInquiryForm!: FormGroup;
  submitting = false;
  submitted = false;
  error: string | null = null;
  submittedInquiry: { inquiry_id: string } | null = null;
  invalidTooltips: Record<string, 'hidden' | 'visible' | 'fading'> = {};
  private tooltipTimers: Record<string, any> = {};

  constructor(
    private fb: FormBuilder,
    private supabase: SupabaseService,
    private toast: ToastService,
    private seo: SeoService
  ) {
    this.weddingInquiryForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/), Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/), Validators.minLength(2)]],
      fianceFirstName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/), Validators.minLength(2)]],
      fianceLastName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/), Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^(\+1\s?)?(\(?\d{3}\)?)[-\s.]?\d{3}[-\s.]?\d{4}$/)]],
      email: ['', [Validators.required, Validators.email]],
      eventDate: ['', Validators.required],
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

    this.addInspirationUrl();
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

  private async insertWeddingInquiryWithRetry(payload: Omit<InquiryInsert, 'inquiry_id'>): Promise<string> {
    const client = this.supabase.getClient();

    let inquiryId = crypto.randomUUID();
    let row: InquiryInsert = { inquiry_id: inquiryId, ...payload };

    let { error } = await client.from('inquiries').insert(row);

    if (error?.code === '23505') {
      console.warn('[inquiries] UUID collision detected, retrying once...');
      inquiryId = crypto.randomUUID();
      row = { inquiry_id: inquiryId, ...payload };

      const retry = await client.from('inquiries').insert(row);
      if (retry.error) throw retry.error;

      return inquiryId;
    }

    if (error) throw error;

    return inquiryId;
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

      const inquiryId = await this.insertWeddingInquiryWithRetry({
        first_name: value.firstName,
        last_name: value.lastName,
        fiance_first_name: value.fianceFirstName,
        fiance_last_name: value.fianceLastName,
        phone: value.phone,
        email: value.email,
        service_type: 'wedding',
        event_date: value.eventDate,
        ceremony_venue: (value.ceremonyVenue ?? '').trim() || null,
        reception_venue: (value.receptionVenue ?? '').trim() || null,
        budget: value.budget,
        guests: value.guests,
        event_planner_name: (value.eventPlannerName ?? '').trim() || null,
        event_planner_phone: (value.eventPlannerPhone ?? '').trim() || null,
        event_planner_email: (value.eventPlannerEmail ?? '').trim() || null,
        preferred_contact_method: value.preferredContactMethod,
        lead_source: value.leadSource,
        notes: value.notes
      });

      const urls = this.getCleanInspirationUrls();
      if (urls.length > 0) {
        const rows = urls.map((u) => ({
          inquiry_id: inquiryId,
          url: u,
        }));

        const { error: urlError } = await this.supabase
          .getClient()
          .from('inspiration_urls')
          .insert(rows);

        if (urlError) {
          console.error('[inspiration_urls] insert error:', urlError);
          this.toast.showToast(
            'Inquiry submitted, but we could not save your inspiration links.',
            'error'
          );
        }
      }

      try {
        await this.triggerInquiryEmails(inquiryId, 'wedding');
      } catch (emailErr) {
        console.error('Email function failed (non-blocking): ', emailErr);
      }

      this.submittedInquiry = { inquiry_id: inquiryId };
      this.submitted = true;

      this.weddingInquiryForm.reset();
      this.requiredControlNames().forEach((name) => (this.invalidTooltips[name] = 'hidden'));
      this.inspirationUrls.clear();
      this.addInspirationUrl();

      this.toast.showToast('Your wedding inquiry has been submitted successfully!', 'success');
    } catch (err: any) {
      console.error('Supabase insert error:', err);

      if (err?.code === '42501') {
        console.error('Your submission was blocked by database security rules (RLS). Please contact support.');
      } else if (err?.message?.includes('Unauthorized') || err?.status === 401) {
        console.error('Request was unauthorized. Please refresh and try again.');
      } else {
        console.error('An error occurred while submitting your inquiry. Please try again later.');
      }

      this.toast.showToast('Failed to submit your wedding inquiry. Please try again later.', 'error');
    } finally {
      this.submitting = false;
    }
  }

  async triggerInquiryEmails(inquiryId: string, inquiryType: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client.functions.invoke('send-inquiry-emails', {
      body: { 
        inquiry_id: inquiryId,
        inquiry_type: inquiryType
      },
    });

    if (error) {
      console.error('[send-inquiry-emails] invoke error:', error);
      throw error;
    }

    console.log('[send-inquiry-emails] response:', data);
  }
}