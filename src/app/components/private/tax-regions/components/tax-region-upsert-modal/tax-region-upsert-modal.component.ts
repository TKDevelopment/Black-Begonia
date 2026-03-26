import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaxRegion } from '../../../../../core/models/tax-region';

export interface TaxRegionUpsertPayload {
  name: string;
  authority_name?: string | null;
  tax_rate: number;
  applies_to_products: boolean;
  applies_to_services: boolean;
  applies_to_delivery: boolean;
  is_active: boolean;
}

@Component({
  selector: 'app-tax-region-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tax-region-upsert-modal.component.html',
})
export class TaxRegionUpsertModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() taxRegion: TaxRegion | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<TaxRegionUpsertPayload>();

  readonly name = signal('');
  readonly authorityName = signal('');
  readonly taxRatePercent = signal('');
  readonly appliesToProducts = signal(true);
  readonly appliesToServices = signal(true);
  readonly appliesToDelivery = signal(true);
  readonly isActive = signal(true);
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || (changes['taxRegion'] && this.open)) {
      this.hydrateForm();
    }
  }

  get title(): string {
    return this.mode === 'create' ? 'Create Tax Region' : 'Edit Tax Region';
  }

  get confirmLabel(): string {
    if (this.saving) {
      return this.mode === 'create' ? 'Creating...' : 'Saving...';
    }

    return this.mode === 'create' ? 'Create Tax Region' : 'Save Changes';
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
    const taxRegion = this.taxRegion;
    this.name.set(taxRegion?.name ?? '');
    this.authorityName.set(taxRegion?.authority_name ?? '');
    this.taxRatePercent.set(taxRegion ? String(Number((taxRegion.tax_rate * 100).toFixed(4))) : '');
    this.appliesToProducts.set(taxRegion?.applies_to_products ?? true);
    this.appliesToServices.set(taxRegion?.applies_to_services ?? true);
    this.appliesToDelivery.set(taxRegion?.applies_to_delivery ?? true);
    this.isActive.set(taxRegion?.is_active ?? true);
    this.validationError.set(null);
  }

  private buildPayload(): TaxRegionUpsertPayload | null {
    const name = this.name().trim();
    const ratePercent = Number(this.taxRatePercent());

    if (!name) {
      this.validationError.set('Region name is required.');
      return null;
    }

    if (Number.isNaN(ratePercent) || ratePercent < 0) {
      this.validationError.set('Tax rate must be a valid non-negative percentage.');
      return null;
    }

    this.validationError.set(null);

    return {
      name,
      authority_name: this.authorityName().trim() || null,
      tax_rate: Number((ratePercent / 100).toFixed(4)),
      applies_to_products: this.appliesToProducts(),
      applies_to_services: this.appliesToServices(),
      applies_to_delivery: this.appliesToDelivery(),
      is_active: this.isActive(),
    };
  }
}

