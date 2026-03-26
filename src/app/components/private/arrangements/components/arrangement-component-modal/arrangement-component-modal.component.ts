import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ArrangementComponent } from '../../../../../core/models/arrangement-component';
import { CatalogItem } from '../../../../../core/models/catalog-item';

export interface ArrangementComponentPayload {
  item_id: string;
  quantity_per_arrangement: number;
  waste_percent?: number | null;
  notes?: string | null;
}

@Component({
  selector: 'app-arrangement-component-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './arrangement-component-modal.component.html',
})
export class ArrangementComponentModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() component: ArrangementComponent | null = null;
  @Input() catalogItems: CatalogItem[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<ArrangementComponentPayload>();

  readonly itemId = signal('');
  readonly quantityPerArrangement = signal('1');
  readonly wastePercent = signal('');
  readonly notes = signal('');
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || (changes['component'] && this.open)) {
      this.hydrateForm();
    }
  }

  get title(): string {
    return this.mode === 'create' ? 'Add Arrangement Component' : 'Edit Arrangement Component';
  }

  get confirmLabel(): string {
    if (this.saving) return 'Saving...';
    return this.mode === 'create' ? 'Add Component' : 'Save Changes';
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

  formatItemLabel(item: CatalogItem): string {
    const sku = item.sku ? ` • ${item.sku}` : '';
    return `${item.name}${sku}`;
  }

  private hydrateForm(): void {
    const component = this.component;
    this.itemId.set(component?.item_id ?? '');
    this.quantityPerArrangement.set(String(component?.quantity_per_arrangement ?? 1));
    this.wastePercent.set(component?.waste_percent != null ? String(component.waste_percent) : '');
    this.notes.set(component?.notes ?? '');
    this.validationError.set(null);
  }

  private buildPayload(): ArrangementComponentPayload | null {
    const quantity = Number(this.quantityPerArrangement());
    const wastePercentValue = this.wastePercent().trim();
    const wastePercent = wastePercentValue ? Number(wastePercentValue) : null;

    if (!this.itemId()) {
      this.validationError.set('Select a catalog item for this arrangement component.');
      return null;
    }

    if (Number.isNaN(quantity) || quantity <= 0) {
      this.validationError.set('Quantity per arrangement must be greater than zero.');
      return null;
    }

    if (wastePercentValue && (Number.isNaN(wastePercent!) || wastePercent! < 0)) {
      this.validationError.set('Reserve percent must be a valid non-negative number.');
      return null;
    }

    this.validationError.set(null);

    return {
      item_id: this.itemId(),
      quantity_per_arrangement: Number(quantity.toFixed(2)),
      waste_percent: wastePercent != null ? Number(wastePercent.toFixed(2)) : null,
      notes: this.notes().trim() || null,
    };
  }
}
