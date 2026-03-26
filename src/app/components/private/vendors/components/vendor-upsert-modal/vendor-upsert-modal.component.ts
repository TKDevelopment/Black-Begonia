import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Vendor } from '../../../../../core/models/vendor';

export interface VendorUpsertPayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
  is_active: boolean;
}

@Component({
  selector: 'app-vendor-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-upsert-modal.component.html',
})
export class VendorUpsertModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() vendor: Vendor | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<VendorUpsertPayload>();

  readonly name = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly website = signal('');
  readonly notes = signal('');
  readonly isActive = signal(true);
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || (changes['vendor'] && this.open)) {
      this.hydrateForm();
    }
  }

  get title(): string {
    return this.mode === 'create' ? 'Create Vendor' : 'Edit Vendor';
  }

  get confirmLabel(): string {
    if (this.saving) {
      return this.mode === 'create' ? 'Creating...' : 'Saving...';
    }

    return this.mode === 'create' ? 'Create Vendor' : 'Save Changes';
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
    const vendor = this.vendor;
    this.name.set(vendor?.name ?? '');
    this.email.set(vendor?.email ?? '');
    this.phone.set(vendor?.phone ?? '');
    this.website.set(vendor?.website ?? '');
    this.notes.set(vendor?.notes ?? '');
    this.isActive.set(vendor?.is_active ?? true);
    this.validationError.set(null);
  }

  private buildPayload(): VendorUpsertPayload | null {
    const name = this.name().trim();
    if (!name) {
      this.validationError.set('Vendor name is required.');
      return null;
    }

    this.validationError.set(null);

    return {
      name,
      email: this.email().trim().toLowerCase() || null,
      phone: this.phone().trim() || null,
      website: this.website().trim() || null,
      notes: this.notes().trim() || null,
      is_active: this.isActive(),
    };
  }
}
