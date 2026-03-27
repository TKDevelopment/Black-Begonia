import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Arrangement } from '../../../../../core/models/arrangement';
import { LaborSettings } from '../../../../../core/models/labor-settings';

export interface ArrangementUpsertPayload {
  name: string;
  category?: string | null;
  description?: string | null;
  design_notes?: string | null;
  labor_settings_id?: string | null;
  design_labor_hours: number;
  markup_percent: number;
  manual_override_sell_price?: number | null;
  is_active: boolean;
}

@Component({
  selector: 'app-arrangement-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './arrangement-upsert-modal.component.html',
})
export class ArrangementUpsertModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() arrangement: Arrangement | null = null;
  @Input() laborSettings: LaborSettings[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<ArrangementUpsertPayload>();

  readonly name = signal('');
  readonly category = signal('');
  readonly description = signal('');
  readonly designNotes = signal('');
  readonly laborSettingsId = signal('');
  readonly designLaborHours = signal('0');
  readonly markupPercent = signal('30');
  readonly manualOverrideSellPrice = signal('');
  readonly isActive = signal(true);
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || (changes['arrangement'] && this.open)) {
      this.hydrateForm();
    }
  }

  get title(): string {
    return this.mode === 'create' ? 'Create Arrangement' : 'Edit Arrangement';
  }

  get confirmLabel(): string {
    if (this.saving) {
      return this.mode === 'create' ? 'Creating...' : 'Saving...';
    }
    return this.mode === 'create' ? 'Create Arrangement' : 'Save Changes';
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
    const arrangement = this.arrangement;
    this.name.set(arrangement?.name ?? '');
    this.category.set(arrangement?.category ?? '');
    this.description.set(arrangement?.description ?? '');
    this.designNotes.set(arrangement?.design_notes ?? '');
    this.laborSettingsId.set(arrangement?.labor_settings_id ?? this.laborSettings.find((setting) => setting.is_default)?.labor_settings_id ?? '');
    this.designLaborHours.set(String(arrangement?.design_labor_hours ?? 0));
    this.markupPercent.set(String(arrangement?.markup_percent ?? this.laborSettings.find((setting) => setting.is_default)?.default_markup_percent ?? 30));
    this.manualOverrideSellPrice.set(arrangement?.manual_override_sell_price != null ? String(arrangement.manual_override_sell_price) : '');
    this.isActive.set(arrangement?.is_active ?? true);
    this.validationError.set(null);
  }

  private buildPayload(): ArrangementUpsertPayload | null {
    const name = this.name().trim();
    const designLaborHours = Number(this.designLaborHours());
    const markupPercent = Number(this.markupPercent());
    const overrideSellPriceValue = this.manualOverrideSellPrice().trim();
    const manualOverrideSellPrice = overrideSellPriceValue ? Number(overrideSellPriceValue) : null;

    if (!name) {
      this.validationError.set('Arrangement name is required.');
      return null;
    }

    if (Number.isNaN(designLaborHours) || designLaborHours < 0) {
      this.validationError.set('Design labor hours must be a valid non-negative number.');
      return null;
    }

    if (Number.isNaN(markupPercent) || markupPercent < 0) {
      this.validationError.set('Markup percent must be a valid non-negative number.');
      return null;
    }

    if (overrideSellPriceValue && (Number.isNaN(manualOverrideSellPrice!) || manualOverrideSellPrice! < 0)) {
      this.validationError.set('Manual override sell price must be a valid non-negative number.');
      return null;
    }

    this.validationError.set(null);

    return {
      name,
      category: this.category().trim() || null,
      description: this.description().trim() || null,
      design_notes: this.designNotes().trim() || null,
      labor_settings_id: this.laborSettingsId() || null,
      design_labor_hours: Number(designLaborHours.toFixed(2)),
      markup_percent: Number(markupPercent.toFixed(2)),
      manual_override_sell_price: manualOverrideSellPrice != null ? Number(manualOverrideSellPrice.toFixed(2)) : null,
      is_active: this.isActive(),
    };
  }
}
