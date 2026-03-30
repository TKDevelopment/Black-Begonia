import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogItem, CatalogItemType, CatalogUnitType } from '../../../../../core/models/catalog-item';

export interface CatalogItemUpsertPayload {
  name: string;
  item_type: CatalogItemType;
  unit_type: CatalogUnitType;
  pack_quantity?: number | null;
  color?: string | null;
  variety?: string | null;
  sku?: string | null;
  base_unit_cost: number;
  is_active: boolean;
}

@Component({
  selector: 'app-catalog-item-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalog-item-upsert-modal.component.html',
})
export class CatalogItemUpsertModalComponent {
  readonly itemTypes: CatalogItemType[] = ['flower', 'greenery', 'hardgood', 'packaging', 'labor', 'fee', 'other'];
  readonly unitTypes: CatalogUnitType[] = ['stem', 'bunch', 'block', 'piece', 'hour', 'foot', 'bundle', 'other'];

  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() item: CatalogItem | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<CatalogItemUpsertPayload>();

  readonly name = signal('');
  readonly itemType = signal<CatalogItemType>('flower');
  readonly unitType = signal<CatalogUnitType>('stem');
  readonly color = signal('');
  readonly variety = signal('');
  readonly sku = signal('');
  readonly packQuantity = signal('');
  readonly baseUnitCost = signal('0.00');
  readonly isActive = signal(true);
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || (changes['item'] && this.open)) {
      this.hydrateForm();
    }
  }

  get title(): string {
    return this.mode === 'create' ? 'Create Catalog Item' : 'Edit Catalog Item';
  }

  get confirmLabel(): string {
    if (this.saving) {
      return this.mode === 'create' ? 'Creating...' : 'Saving...';
    }

    return this.mode === 'create' ? 'Create Item' : 'Save Changes';
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

  formatLabel(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  requiresPackQuantity(unitType: CatalogUnitType): boolean {
    return unitType === 'bunch' || unitType === 'bundle';
  }

  onUnitTypeChange(value: CatalogUnitType): void {
    this.unitType.set(value);

    if (!this.requiresPackQuantity(value)) {
      this.packQuantity.set('');
    }
  }

  private hydrateForm(): void {
    const item = this.item;
    this.name.set(item?.name ?? '');
    this.itemType.set(item?.item_type ?? 'flower');
    this.unitType.set(item?.unit_type ?? 'stem');
    this.packQuantity.set(item?.pack_quantity != null ? String(item.pack_quantity) : '');
    this.color.set(item?.color ?? '');
    this.variety.set(item?.variety ?? '');
    this.sku.set(item?.sku ?? '');
    this.baseUnitCost.set((item?.base_unit_cost ?? 0).toFixed(2));
    this.isActive.set(item?.is_active ?? true);
    this.validationError.set(null);
  }

  private buildPayload(): CatalogItemUpsertPayload | null {
    const name = this.name().trim();
    const baseUnitCost = Number(this.baseUnitCost());
    const unitType = this.unitType();
    const rawPackQuantity = String(this.packQuantity() ?? '').trim();
    const requiresPackQuantity = this.requiresPackQuantity(unitType);
    const packQuantity = rawPackQuantity.length ? Number(rawPackQuantity) : null;

    if (!name) {
      this.validationError.set('Item name is required.');
      return null;
    }

    if (Number.isNaN(baseUnitCost) || baseUnitCost < 0) {
      this.validationError.set('Base unit cost must be a valid non-negative number.');
      return null;
    }

    if (requiresPackQuantity && (packQuantity == null || Number.isNaN(packQuantity) || packQuantity <= 0)) {
      this.validationError.set('Pack quantity must be a valid number greater than 0 for bunches and bundles.');
      return null;
    }

    this.validationError.set(null);

    return {
      name,
      item_type: this.itemType(),
      unit_type: unitType,
      pack_quantity: requiresPackQuantity ? Number(packQuantity!.toFixed(2)) : null,
      color: this.color().trim() || null,
      variety: this.variety().trim() || null,
      sku: this.sku().trim() || null,
      base_unit_cost: Number(baseUnitCost.toFixed(2)),
      is_active: this.isActive(),
    };
  }
}
