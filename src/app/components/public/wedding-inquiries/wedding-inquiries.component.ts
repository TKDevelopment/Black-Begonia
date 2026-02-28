import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../services/toast.service';
import { SeoService } from '../../../seo/seo.service';
import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-wedding-inquiries',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './wedding-inquiries.component.html',
  styleUrl: './wedding-inquiries.component.scss'
})
export class WeddingInquiriesComponent {

  weddingInquiryForm!: FormGroup;
  submitting: boolean = false;
  submitted: boolean = false;
  error: string | null = null;
  submittedInquiry: any = null;

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
      guests: ['', Validators.required],
      preferredContactMethod: ['', Validators.required],
      leadSource: ['', Validators.required],
      notes: ['', [Validators.required, Validators.maxLength(500)]]
    });
  }

  async onSubmit(): Promise<void> {
    if (this.weddingInquiryForm.invalid) {
      this.weddingInquiryForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.submitted = false;
    this.error = null;
    
    const { value } = this.weddingInquiryForm;
    
    const { data, error } = await this.supabase.getClient()
      .from('inquiries')
      .insert(
        {
          first_name: value.firstName,
          last_name: value.lastName,
          fiance_first_name: value.fianceFirstName,
          fiance_last_name: value.fianceLastName,
          phone: value.phone,
          email: value.email,
          service_type: 'wedding',
          event_date: value.eventDate,
          ceremony_venue: value.ceremonyVenue,
          reception_venue: value.receptionVenue,
          budget: value.budget,
          guests: value.guests,
          preferred_contact_method: value.preferredContactMethod,
          lead_source: value.leadSource,
          notes: value.notes,
          created_at: new Date().toISOString(),
          last_updated_at: null
        }
      )
      .select()
      .single();

    this.submittedInquiry = data;
    this.submitting = false;

    if (error) {
      this.error = 'An error occurred while submitting your inquiry. Please try again later.';
      this.toast.showToast('Failed to submit your wedding inquiry. Please try again later.', 'error');
      console.error('Supabase insert error:', error);
    } else {
      this.submitted = true;
      this.weddingInquiryForm.reset();
      this.toast.showToast('Your wedding inquiry has been submitted successfully!', 'success');
    }
  }

}