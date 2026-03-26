import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Organization, OrganizationType } from '../../../../../core/models/organization';

export interface OrganizationUpsertPayload {
  name: string;
  organization_type: OrganizationType;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  notes?: string | null;
}

@Component({
  selector: 'app-organization-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './organization-upsert-modal.component.html',
})
export class OrganizationUpsertModalComponent {
  readonly organizationTypes: OrganizationType[] = [
    'venue',
    'planner',
    'vendor',
    'corporate_client',
    'rental_company',
    'hospitality',
    'other',
  ];

  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() organization: Organization | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<OrganizationUpsertPayload>();

  readonly name = signal('');
  readonly organizationType = signal<OrganizationType>('vendor');
  readonly email = signal('');
  readonly phone = signal('');
  readonly website = signal('');
  readonly addressLine1 = signal('');
  readonly addressLine2 = signal('');
  readonly city = signal('');
  readonly state = signal('');
  readonly postalCode = signal('');
  readonly country = signal('US');
  readonly notes = signal('');
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || (changes['organization'] && this.open)) {
      this.hydrateForm();
    }
  }

  get title(): string {
    return this.mode === 'create' ? 'Create Organization' : 'Edit Organization';
  }

  get confirmLabel(): string {
    if (this.saving) {
      return this.mode === 'create' ? 'Creating...' : 'Saving...';
    }

    return this.mode === 'create' ? 'Create Organization' : 'Save Changes';
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
    const organization = this.organization;
    this.name.set(organization?.name ?? '');
    this.organizationType.set(organization?.organization_type ?? 'vendor');
    this.email.set(organization?.email ?? '');
    this.phone.set(organization?.phone ?? '');
    this.website.set(organization?.website ?? '');
    this.addressLine1.set(organization?.address_line_1 ?? '');
    this.addressLine2.set(organization?.address_line_2 ?? '');
    this.city.set(organization?.city ?? '');
    this.state.set(organization?.state ?? '');
    this.postalCode.set(organization?.postal_code ?? '');
    this.country.set(organization?.country ?? 'US');
    this.notes.set(organization?.notes ?? '');
    this.validationError.set(null);
  }

  private buildPayload(): OrganizationUpsertPayload | null {
    const name = this.name().trim();
    const organizationType = this.organizationType();

    if (!name || !organizationType) {
      this.validationError.set('Organization name and type are required.');
      return null;
    }

    this.validationError.set(null);

    return {
      name,
      organization_type: organizationType,
      email: this.email().trim().toLowerCase() || null,
      phone: this.phone().trim() || null,
      website: this.website().trim() || null,
      address_line_1: this.addressLine1().trim() || null,
      address_line_2: this.addressLine2().trim() || null,
      city: this.city().trim() || null,
      state: this.state().trim() || null,
      postal_code: this.postalCode().trim() || null,
      country: this.country().trim() || 'US',
      notes: this.notes().trim() || null,
    };
  }
}
