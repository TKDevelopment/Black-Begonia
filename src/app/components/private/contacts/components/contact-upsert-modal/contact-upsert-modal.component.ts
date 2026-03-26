import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Contact, ContactType } from '../../../../../core/models/contact';

export interface ContactUpsertPayload {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  secondary_phone?: string | null;
  preferred_contact_method?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  contact_type: ContactType;
  notes?: string | null;
}

@Component({
  selector: 'app-contact-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact-upsert-modal.component.html',
})
export class ContactUpsertModalComponent {
  readonly contactTypes: ContactType[] = [
    'client',
    'partner',
    'planner',
    'venue_contact',
    'vendor_contact',
    'other',
  ];

  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() contact: Contact | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<ContactUpsertPayload>();

  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly secondaryPhone = signal('');
  readonly preferredContactMethod = signal('email');
  readonly addressLine1 = signal('');
  readonly addressLine2 = signal('');
  readonly city = signal('');
  readonly state = signal('');
  readonly postalCode = signal('');
  readonly country = signal('US');
  readonly contactType = signal<ContactType>('client');
  readonly notes = signal('');
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || (changes['contact'] && this.open)) {
      this.hydrateForm();
    }
  }

  get title(): string {
    return this.mode === 'create' ? 'Create Contact' : 'Edit Contact';
  }

  get confirmLabel(): string {
    if (this.saving) {
      return this.mode === 'create' ? 'Creating...' : 'Saving...';
    }

    return this.mode === 'create' ? 'Create Contact' : 'Save Changes';
  }

  onClose(): void {
    if (this.saving) return;
    this.validationError.set(null);
    this.close.emit();
  }

  onConfirm(): void {
    const payload = this.buildPayload();
    if (!payload) return;
    this.confirm.emit(payload);
  }

  private hydrateForm(): void {
    const contact = this.contact;
    this.firstName.set(contact?.first_name ?? '');
    this.lastName.set(contact?.last_name ?? '');
    this.email.set(contact?.email ?? '');
    this.phone.set(contact?.phone ?? '');
    this.secondaryPhone.set(contact?.secondary_phone ?? '');
    this.preferredContactMethod.set(contact?.preferred_contact_method ?? 'email');
    this.addressLine1.set(contact?.address_line_1 ?? '');
    this.addressLine2.set(contact?.address_line_2 ?? '');
    this.city.set(contact?.city ?? '');
    this.state.set(contact?.state ?? '');
    this.postalCode.set(contact?.postal_code ?? '');
    this.country.set(contact?.country ?? 'US');
    this.contactType.set(contact?.contact_type ?? 'client');
    this.notes.set(contact?.notes ?? '');
    this.validationError.set(null);
  }

  private buildPayload(): ContactUpsertPayload | null {
    const firstName = this.firstName().trim();
    const lastName = this.lastName().trim();
    const contactType = this.contactType();

    if (!firstName || !lastName || !contactType) {
      this.validationError.set('First name, last name, and contact type are required.');
      return null;
    }

    this.validationError.set(null);

    return {
      first_name: firstName,
      last_name: lastName,
      email: this.email().trim().toLowerCase() || null,
      phone: this.phone().trim() || null,
      secondary_phone: this.secondaryPhone().trim() || null,
      preferred_contact_method: this.preferredContactMethod().trim() || null,
      address_line_1: this.addressLine1().trim() || null,
      address_line_2: this.addressLine2().trim() || null,
      city: this.city().trim() || null,
      state: this.state().trim() || null,
      postal_code: this.postalCode().trim() || null,
      country: this.country().trim() || 'US',
      contact_type: contactType,
      notes: this.notes().trim() || null,
    };
  }
}
