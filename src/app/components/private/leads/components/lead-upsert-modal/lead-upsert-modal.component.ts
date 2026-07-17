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

import {
  formatLeadSourceLabel,
  LEAD_SOURCE_VALUES,
  SupabaseLeadSource,
} from '../../../../../core/leads/lead-source-catalog';
import {
  FloralServiceDefinition,
  FloralServiceEventType,
  getFloralServicesForEventType,
  resolveFloralServiceLabel,
} from '../../../../../core/floral-services/floral-service-catalog';
import { Lead } from '../../../../../core/models/lead';
import { LeadStatus } from '../../../../../core/models/lead-status';
import { InternalUser } from '../../../../../core/models/internal-user';
import { LeadUpsertPayload } from './lead-upsert.types';

type LeadEventType = FloralServiceEventType;

@Component({
  selector: 'app-lead-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-upsert-modal.component.html',
  styleUrl: './lead-upsert-modal.component.scss',
})
export class LeadUpsertModalComponent {
  private readonly weddingServiceOptions = getFloralServicesForEventType('wedding');
  private readonly generalServiceOptions = getFloralServicesForEventType('general');
  private originalServiceType = '';

  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() lead: Lead | null = null;
  @Input() internalUsers: InternalUser[] = [];
  @Input() allowedStatuses: LeadStatus[] = [];

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
  readonly ceremonyVenueAddress = signal('');
  readonly ceremonyVenueZipcode = signal('');
  readonly ceremonyStartTime = signal('');
  readonly receptionVenueName = signal('');
  readonly receptionVenueCity = signal('');
  readonly receptionVenueState = signal('');
  readonly receptionVenueAddress = signal('');
  readonly receptionVenueZipcode = signal('');
  readonly receptionStartTime = signal('');
  readonly eventStartTime = signal('');
  readonly budgetRange = signal('');
  readonly guestCount = signal<string | number>('');
  readonly inquiryMessage = signal('');
  readonly source = signal<SupabaseLeadSource>('other');
  readonly status = signal<LeadStatus>('new');
  readonly declineReason = signal('');
  readonly consultationScheduledAt = signal('');
  readonly consultationCompletedAt = signal('');
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

  get serviceTypeOptions(): FloralServiceDefinition[] {
    return this.isWedding ? this.weddingServiceOptions : this.generalServiceOptions;
  }

  get selectedService(): FloralServiceDefinition | null {
    return (
      this.serviceTypeOptions.find((option) => option.label === this.serviceType()) ?? null
    );
  }

  get statusOptions(): LeadStatus[] {
    const currentStatus = this.status();
    const options = this.allowedStatuses.length ? this.allowedStatuses : [currentStatus];
    return options.includes(currentStatus) ? options : [currentStatus, ...options];
  }

  get leadSourceOptions(): readonly SupabaseLeadSource[] {
    return LEAD_SOURCE_VALUES;
  }

  formatLeadSource(source: SupabaseLeadSource): string {
    return formatLeadSourceLabel(source);
  }

  formatStatus(status: LeadStatus): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  }

  get serviceTypeLifecycleHint(): string {
    const selectedService = this.selectedService;

    if (!selectedService) {
      return this.isWedding
        ? 'Wedding leads stay in the project lifecycle and use wedding-specific proposal renderers.'
        : 'Choose the general service that best matches the lead so the CRM can route it into the right lifecycle.';
    }

    const workflowLabel =
      selectedService.workflowMode === 'subscription'
        ? 'subscription lifecycle'
        : 'project lifecycle';
    const documentLabel =
      selectedService.documentMode === 'agreement'
        ? 'a basic agreement'
        : 'a full floral proposal';

    return `${selectedService.description} This service stays in the ${workflowLabel} and defaults to ${documentLabel}.`;
  }

  onEventTypeChange(value: LeadEventType): void {
    this.eventType.set(value);

    if (!this.serviceTypeOptions.some((option) => option.label === this.serviceType())) {
      this.serviceType.set('');
    }
  }

  onPhoneInput(value: string): void {
    this.phone.set(this.formatPhoneForDisplay(value));
  }

  onPlannerPhoneInput(value: string): void {
    this.plannerPhone.set(this.formatPhoneForDisplay(value));
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
    this.originalServiceType = lead?.service_type?.trim() ?? '';
    this.serviceType.set(
      this.getValidServiceType(lead?.service_type ?? '', nextEventType)
    );
    this.firstName.set(lead?.first_name ?? '');
    this.lastName.set(lead?.last_name ?? '');
    this.partnerFirstName.set(lead?.partner_first_name ?? '');
    this.partnerLastName.set(lead?.partner_last_name ?? '');
    this.plannerName.set(lead?.planner_name ?? '');
    this.plannerPhone.set(this.formatPhoneForDisplay(lead?.planner_phone ?? ''));
    this.plannerEmail.set(lead?.planner_email ?? '');
    this.email.set(lead?.email ?? '');
    this.phone.set(this.formatPhoneForDisplay(lead?.phone ?? ''));
    this.preferredContactMethod.set(lead?.preferred_contact_method ?? 'email');
    this.eventDate.set(lead?.event_date ?? '');
    this.ceremonyVenueName.set(lead?.ceremony_venue_name ?? '');
    this.ceremonyVenueCity.set(lead?.ceremony_venue_city ?? '');
    this.ceremonyVenueState.set(lead?.ceremony_venue_state ?? '');
    this.ceremonyVenueAddress.set(lead?.ceremony_venue_address ?? '');
    this.ceremonyVenueZipcode.set(lead?.ceremony_venue_zipcode ?? '');
    this.ceremonyStartTime.set(lead?.ceremony_start_time ?? '');
    this.receptionVenueName.set(lead?.reception_venue_name ?? '');
    this.receptionVenueCity.set(lead?.reception_venue_city ?? '');
    this.receptionVenueState.set(lead?.reception_venue_state ?? '');
    this.receptionVenueAddress.set(lead?.reception_venue_address ?? '');
    this.receptionVenueZipcode.set(lead?.reception_venue_zipcode ?? '');
    this.receptionStartTime.set(lead?.reception_start_time ?? '');
    this.eventStartTime.set(lead?.event_start_time ?? '');
    this.budgetRange.set(lead?.budget_range ?? '');
    this.guestCount.set(lead?.guest_count != null ? String(lead.guest_count) : '');
    this.inquiryMessage.set(lead?.inquiry_message ?? '');
    this.source.set(
      LEAD_SOURCE_VALUES.includes(lead?.source as SupabaseLeadSource)
        ? lead?.source as SupabaseLeadSource
        : 'other'
    );
    this.status.set(lead?.status ?? 'new');
    this.declineReason.set(lead?.decline_reason ?? '');
    this.consultationScheduledAt.set(this.toDateTimeLocal(lead?.consultation_scheduled_at));
    this.consultationCompletedAt.set(this.toDateTimeLocal(lead?.consultation_completed_at));
    this.validationError.set(null);
  }

  private getValidServiceType(serviceType: string, eventType: LeadEventType): string {
    return resolveFloralServiceLabel(serviceType, eventType) ?? '';
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

    const selectedService = this.serviceTypeOptions.find((option) => option.label === serviceType);
    if (!selectedService) {
      this.validationError.set('Please choose a valid service type for the selected event type.');
      return null;
    }

    const guestCountValue = String(this.guestCount() ?? '').trim();
    const guestCount = guestCountValue ? Number(guestCountValue) : null;

    if (guestCountValue && Number.isNaN(guestCount)) {
      this.validationError.set('Guest count must be a valid number.');
      return null;
    }

    this.validationError.set(null);

    return {
      event_type: this.eventType(),
      service_type:
        this.mode === 'edit' &&
        resolveFloralServiceLabel(this.originalServiceType, this.eventType()) === selectedService.label
          ? this.originalServiceType
          : selectedService.databaseValue,
      first_name: firstName,
      last_name: lastName,
      partner_first_name: this.partnerFirstName().trim() || null,
      partner_last_name: this.partnerLastName().trim() || null,
      planner_name: this.plannerName().trim() || null,
      planner_phone: this.phoneDigits(this.plannerPhone()) || null,
      planner_email: this.plannerEmail().trim().toLowerCase() || null,
      email,
      phone: this.phoneDigits(this.phone()) || null,
      preferred_contact_method: this.preferredContactMethod().trim() || null,
      event_date: this.eventDate().trim() || null,
      ceremony_venue_name: this.ceremonyVenueName().trim() || null,
      ceremony_venue_city: this.ceremonyVenueCity().trim() || null,
      ceremony_venue_state: this.ceremonyVenueState().trim() || null,
      ceremony_venue_address: this.ceremonyVenueAddress().trim() || null,
      ceremony_venue_zipcode: this.ceremonyVenueZipcode().trim() || null,
      ceremony_start_time: this.ceremonyStartTime().trim() || null,
      reception_venue_name: this.receptionVenueName().trim() || null,
      reception_venue_city: this.receptionVenueCity().trim() || null,
      reception_venue_state: this.receptionVenueState().trim() || null,
      reception_venue_address: this.receptionVenueAddress().trim() || null,
      reception_venue_zipcode: this.receptionVenueZipcode().trim() || null,
      reception_start_time: this.receptionStartTime().trim() || null,
      event_start_time: this.eventStartTime().trim() || null,
      budget_range: this.budgetRange().trim() || null,
      guest_count: guestCount,
      inquiry_message: this.inquiryMessage().trim() || null,
      source: this.source(),
      status: this.status(),
      decline_reason: this.declineReason().trim() || null,
      consultation_scheduled_at: this.toIsoDateTime(this.consultationScheduledAt()),
      consultation_completed_at: this.toIsoDateTime(this.consultationCompletedAt()),
    };
  }

  onStatusChange(value: string): void {
    this.status.set(value as LeadStatus);
  }

  private toDateTimeLocal(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toIsoDateTime(value: string): string | null {
    const normalized = value.trim();
    if (!normalized) return null;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private formatPhoneForDisplay(value: string): string {
    const digits = this.phoneDigits(value);

    if (digits.length <= 3) {
      return digits;
    }

    if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  private phoneDigits(value: string): string {
    const digits = value.replace(/\D/g, '');
    const normalized = digits.length > 10 && digits.startsWith('1')
      ? digits.slice(1)
      : digits;
    return normalized.slice(0, 10);
  }
}
