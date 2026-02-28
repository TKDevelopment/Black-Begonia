import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SupabaseService } from '../../../services/supabase.service';
import { ToastService } from '../../../services/toast.service';
import { SeoService } from '../../../seo/seo.service';

type InquiryInsert = {
  inquiry_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  service_type: string;
  event_date: string; // YYYY-MM-DD
  preferred_contact_method: string;
  lead_source: string;
  notes: string;
};

@Component({
  selector: 'app-general-inquiries',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './general-inquiries.component.html',
  styleUrl: './general-inquiries.component.scss',
})
export class GeneralInquiriesComponent {
  generalInquiryForm!: FormGroup;

  submitting = false;
  submitted = false;
  error: string | null = null;
  submittedInquiry: { inquiry_id: string } | null = null;

  constructor(
    private fb: FormBuilder,
    private supabase: SupabaseService,
    private toast: ToastService,
    private seo: SeoService
  ) {
    // optional: if you use SeoService for this route, do it here.
    // this.seo.setTitle('General Inquiries');

    this.generalInquiryForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/), Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/), Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^(\+1\s?)?(\(?\d{3}\)?)[-\s.]?\d{3}[-\s.]?\d{4}$/)]],
      email: ['', [Validators.required, Validators.email]],
      serviceType: ['', Validators.required],
      eventDate: ['', Validators.required],
      preferredContactMethod: ['', Validators.required],
      leadSource: ['', Validators.required],
      notes: ['', [Validators.required, Validators.maxLength(500)]],
      inspirationUrls: this.fb.array([]),
    });

    this.addInspirationUrl();
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

    // de-dupe
    return Array.from(new Set(urls));
  }

  private async insertInquiryWithRetry(payload: Omit<InquiryInsert, 'inquiry_id'>): Promise<string> {
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

  async onSubmit(): Promise<void> {
    if (this.generalInquiryForm.invalid) {
      this.generalInquiryForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.submitted = false;
    this.error = null;
    this.submittedInquiry = null;

    try {
      const { value } = this.generalInquiryForm;

      const inquiryId = await this.insertInquiryWithRetry({
        first_name: value.firstName,
        last_name: value.lastName,
        phone: value.phone,
        email: value.email,
        service_type: value.serviceType,
        event_date: value.eventDate,
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
        await this.triggerInquiryEmails(inquiryId, 'general');
      } catch (emailErr) {
        console.error('Email function failed (non-blocking): ', emailErr);
      }

      this.submittedInquiry = { inquiry_id: inquiryId };
      this.submitted = true;

      this.generalInquiryForm.reset();
      this.inspirationUrls.clear();
      this.addInspirationUrl();

      this.toast.showToast('Your inquiry has been submitted successfully!', 'success');
    } catch (err: any) {
      console.error('Supabase insert error:', err);

      if (err?.code === '42501') {
        console.error('Your submission was blocked by database security rules (RLS). Please contact support.');
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