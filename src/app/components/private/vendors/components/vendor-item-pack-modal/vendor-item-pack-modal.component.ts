import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogItem } from '../../../../../core/models/catalog-item';
import { VendorItemPack } from '../../../../../core/models/vendor-item-pack';

export interface VendorItemPackPayload {
  item_id: string;
  purchase_unit_name: string;
  units_per_pack: number;
  pack_price: number;
  minimum_order_packs: number;
  is_default: boolean;
}

@Component({
  selector: 'app-vendor-item-pack-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-item-pack-modal.component.html',
})
export class VendorItemPackModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() pack: VendorItemPack | null = null;
  @Input() catalogItems: CatalogItem[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<VendorItemPackPayload>();

  readonly itemId = signal('');
  readonly purchaseUnitName = signal('');
  readonly unitsPerPack = signal('1');
  readonly packPrice = signal('0.00');
  readonly minimumOrderPacks = signal('1');
  readonly isDefault = signal(false);
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || (changes['pack'] && this.open)) {
      this.hydrateForm();
    }
  }

  get title(): string {
    return this.mode === 'create' ? 'Add Vendor Pack' : 'Edit Vendor Pack';
  }

  get confirmLabel(): string {
    if (this.saving) {
      return this.mode === 'create' ? 'Saving...' : 'Saving...';
    }

    return this.mode === 'create' ? 'Add Pack' : 'Save Changes';
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
    const pack = this.pack;
    this.itemId.set(pack?.item_id ?? '');
    this.purchaseUnitName.set(pack?.purchase_unit_name ?? '');
    this.unitsPerPack.set(String(pack?.units_per_pack ?? 1));
    this.packPrice.set((pack?.pack_price ?? 0).toFixed(2));
    this.minimumOrderPacks.set(String(pack?.minimum_order_packs ?? 1));
    this.isDefault.set(pack?.is_default ?? false);
    this.validationError.set(null);
  }

  private buildPayload(): VendorItemPackPayload | null {
    const unitsPerPack = Number(this.unitsPerPack());
    const packPrice = Number(this.packPrice());
    const minimumOrderPacks = Number(this.minimumOrderPacks());

    if (!this.itemId()) {
      this.validationError.set('Select a catalog item for this vendor pack.');
      return null;
    }

    if (!this.purchaseUnitName().trim()) {
      this.validationError.set('Purchase unit name is required.');
      return null;
    }

    if (Number.isNaN(unitsPerPack) || unitsPerPack <= 0) {
      this.validationError.set('Units per pack must be greater than zero.');
      return null;
    }

    if (Number.isNaN(packPrice) || packPrice < 0) {
      this.validationError.set('Pack price must be a valid non-negative number.');
      return null;
    }

    if (Number.isNaN(minimumOrderPacks) || minimumOrderPacks <= 0) {
      this.validationError.set('Minimum order packs must be at least 1.');
      return null;
    }

    this.validationError.set(null);

    return {
      item_id: this.itemId(),
      purchase_unit_name: this.purchaseUnitName().trim(),
      units_per_pack: Number(unitsPerPack.toFixed(2)),
      pack_price: Number(packPrice.toFixed(2)),
      minimum_order_packs: Math.trunc(minimumOrderPacks),
      is_default: this.isDefault(),
    };
  }
}
