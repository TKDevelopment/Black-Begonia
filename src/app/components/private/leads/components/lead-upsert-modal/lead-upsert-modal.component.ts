import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Lead } from '../../../../../core/models/lead';
import { LeadUpsertPayload } from './lead-upsert.types';

type LeadEventType = 'general' | 'wedding';

@Component({
  selector: 'app-lead-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-upsert-modal.component.html',
  styleUrl: './lead-upsert-modal.component.scss',
})
export class LeadUpsertModalComponent {
  private readonly weddingServiceOptions: string[] = [
    'full-service wedding',
    'ceremony-only wedding',
    'elopement',
    'engagement',
  ];

  private readonly generalServiceOptions: string[] = [
    'birthday',
    'funeral',
    'corporate',
    'bridal shower',
    'baby shower',
    'anniversary',
    'rehearsal',
    'proposal',
    'subscription',
    'private lessons',
    'other',
    'workshop',
    'private event',
  ];

  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() lead: Lead | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<LeadUpsertPayload>();

  readonly eventType = signal<LeadEventType>('general');
  readonly serviceType = signal('');
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly partnerFirstName = signal('');
  readonly partnerLastName = signal('');
  readonly plannerName = signal('');
  readonly plannerPhone = signal('');
  readonly plannerEmail = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly preferredContactMethod = signal('email');
  readonly eventDate = signal('');
  readonly ceremonyVenueName = signal('');
  readonly ceremonyVenueCity = signal('');
  readonly ceremonyVenueState = signal('');
  readonly receptionVenueName = signal('');
  readonly receptionVenueCity = signal('');
  readonly receptionVenueState = signal('');
  readonly budgetRange = signal('');
  readonly guestCount = signal<string>('');
  readonly inquiryMessage = signal('');
  readonly source = signal('other');
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.hydrateForm();
    }

    if (changes['lead'] && this.open) {
      this.hydrateForm();
    }
  }

  get title(): string {
    return this.mode === 'create' ? 'Create Lead' : 'Edit Lead';
  }

  get confirmLabel(): string {
    if (this.saving) {
      return this.mode === 'create' ? 'Creating...' : 'Saving...';
    }

    return this.mode === 'create' ? 'Create Lead' : 'Save Changes';
  }

  get isWedding(): boolean {
    return this.eventType() === 'wedding';
  }

  get serviceTypeOptions(): string[] {
    return this.isWedding ? this.weddingServiceOptions : this.generalServiceOptions;
  }

  onEventTypeChange(value: LeadEventType): void {
    this.eventType.set(value);

    if (!this.serviceTypeOptions.includes(this.serviceType())) {
      this.serviceType.set('');
    }
  }

  onClose(): void {
    if (this.saving) return;
    this.validationError.set(null);
    this.close.emit();
  }

  onConfirm(): void {
    const payload = this.buildPayload();
    if (!payload) {
      return;
    }

    this.confirm.emit(payload);
  }

  private hydrateForm(): void {
    const lead = this.lead;
    const nextEventType: LeadEventType = lead?.event_type === 'wedding' ? 'wedding' : 'general';

    this.eventType.set(nextEventType);
    this.serviceType.set(
      this.getValidServiceType(lead?.service_type ?? '', nextEventType)
    );
    this.firstName.set(lead?.first_name ?? '');
    this.lastName.set(lead?.last_name ?? '');
    this.partnerFirstName.set(lead?.partner_first_name ?? '');
    this.partnerLastName.set(lead?.partner_last_name ?? '');
    this.plannerName.set(lead?.planner_name ?? '');
    this.plannerPhone.set(lead?.planner_phone ?? '');
    this.plannerEmail.set(lead?.planner_email ?? '');
    this.email.set(lead?.email ?? '');
    this.phone.set(lead?.phone ?? '');
    this.preferredContactMethod.set(lead?.preferred_contact_method ?? 'email');
    this.eventDate.set(lead?.event_date ?? '');
    this.ceremonyVenueName.set(lead?.ceremony_venue_name ?? '');
    this.ceremonyVenueCity.set(lead?.ceremony_venue_city ?? '');
    this.ceremonyVenueState.set(lead?.ceremony_venue_state ?? '');
    this.receptionVenueName.set(lead?.reception_venue_name ?? '');
    this.receptionVenueCity.set(lead?.reception_venue_city ?? '');
    this.receptionVenueState.set(lead?.reception_venue_state ?? '');
    this.budgetRange.set(lead?.budget_range ?? '');
    this.guestCount.set(lead?.guest_count != null ? String(lead.guest_count) : '');
    this.inquiryMessage.set(lead?.inquiry_message ?? '');
    this.source.set(lead?.source ?? 'other');
    this.validationError.set(null);
  }

  private getValidServiceType(serviceType: string, eventType: LeadEventType): string {
    const options = eventType === 'wedding' ? this.weddingServiceOptions : this.generalServiceOptions;
    return options.includes(serviceType) ? serviceType : '';
  }

  private buildPayload(): LeadUpsertPayload | null {
    const firstName = this.firstName().trim();
    const lastName = this.lastName().trim();
    const email = this.email().trim().toLowerCase();
    const serviceType = this.serviceType().trim();

    if (!firstName || !lastName || !email || !serviceType) {
      this.validationError.set('First name, last name, email, and service type are required.');
      return null;
    }

    if (!this.serviceTypeOptions.includes(serviceType)) {
      this.validationError.set('Please choose a valid service type for the selected event type.');
      return null;
    }

    const guestCountValue = this.guestCount().trim();
    const guestCount = guestCountValue ? Number(guestCountValue) : null;

    if (guestCountValue && Number.isNaN(guestCount)) {
      this.validationError.set('Guest count must be a valid number.');
      return null;
    }

    this.validationError.set(null);

    return {
      event_type: this.eventType(),
      service_type: serviceType,
      first_name: firstName,
      last_name: lastName,
      partner_first_name: this.partnerFirstName().trim() || null,
      partner_last_name: this.partnerLastName().trim() || null,
      planner_name: this.plannerName().trim() || null,
      planner_phone: this.plannerPhone().trim() || null,
      planner_email: this.plannerEmail().trim().toLowerCase() || null,
      email,
      phone: this.phone().trim() || null,
      preferred_contact_method: this.preferredContactMethod().trim() || null,
      event_date: this.eventDate().trim() || null,
      ceremony_venue_name: this.ceremonyVenueName().trim() || null,
      ceremony_venue_city: this.ceremonyVenueCity().trim() || null,
      ceremony_venue_state: this.ceremonyVenueState().trim() || null,
      reception_venue_name: this.receptionVenueName().trim() || null,
      reception_venue_city: this.receptionVenueCity().trim() || null,
      reception_venue_state: this.receptionVenueState().trim() || null,
      budget_range: this.budgetRange().trim() || null,
      guest_count: guestCount,
      inquiry_message: this.inquiryMessage().trim() || null,
      source: this.source().trim() || 'other',
    };
  }
}
