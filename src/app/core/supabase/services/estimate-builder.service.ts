import { Injectable } from '@angular/core';
import { Arrangement } from '../../models/arrangement';
import { ArrangementComponent } from '../../models/arrangement-component';
import {
  EstimateLineItem,
  EstimateLineItemComponentSnapshot,
  EstimateLineItemType,
  ShoppingListItem,
} from '../../models/estimate';
import { TaxRegion } from '../../models/tax-region';
import { VendorItemPack } from '../../models/vendor-item-pack';

export interface EstimateBuilderLine {
  local_id: string;
  line_type: EstimateLineItemType;
  arrangement_id?: string | null;
  arrangement?: Arrangement | null;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  line_subtotal: number;
}

@Injectable({
  providedIn: 'root',
})
export class EstimateBuilderService {
  createArrangementLine(arrangement: Arrangement): EstimateBuilderLine {
    const unitPrice = arrangement.manual_override_sell_price ?? arrangement.suggested_sell_price ?? 0;

    return {
      local_id: this.createLocalId(),
      line_type: 'arrangement',
      arrangement_id: arrangement.arrangement_id,
      arrangement,
      name: arrangement.name,
      description: arrangement.description ?? null,
      quantity: 1,
      unit_price: Number(unitPrice.toFixed(2)),
      line_subtotal: Number(unitPrice.toFixed(2)),
    };
  }

  createManualLine(
    lineType: EstimateLineItemType,
    name: string,
    quantity: number,
    unitPrice: number,
    description?: string | null
  ): EstimateBuilderLine {
    return this.recalculateLine({
      local_id: this.createLocalId(),
      line_type: lineType,
      arrangement_id: null,
      arrangement: null,
      name,
      description: description ?? null,
      quantity,
      unit_price: unitPrice,
      line_subtotal: 0,
    });
  }

  recalculateLine(line: EstimateBuilderLine): EstimateBuilderLine {
    const quantity = Number.isFinite(line.quantity) ? Number(line.quantity) : 0;
    const unitPrice = Number.isFinite(line.unit_price) ? Number(line.unit_price) : 0;

    return {
      ...line,
      quantity: Number(quantity.toFixed(2)),
      unit_price: Number(unitPrice.toFixed(2)),
      line_subtotal:
        line.line_type === 'discount'
          ? Number((-1 * Math.abs(quantity * unitPrice)).toFixed(2))
          : Number((quantity * unitPrice).toFixed(2)),
    };
  }

  calculateTotals(lines: EstimateBuilderLine[], taxRegion: TaxRegion | null): {
    subtotal: number;
    discountTotal: number;
    feeTotal: number;
    taxableAmount: number;
    taxTotal: number;
    grandTotal: number;
  } {
    const subtotal = Number(
      lines
        .filter((line) => ['arrangement', 'custom'].includes(line.line_type))
        .reduce((sum, line) => sum + Math.max(line.line_subtotal, 0), 0)
        .toFixed(2)
    );
    const discountTotal = Number(
      Math.abs(
        lines
          .filter((line) => line.line_type === 'discount')
          .reduce((sum, line) => sum + line.line_subtotal, 0)
      ).toFixed(2)
    );
    const feeTotal = Number(
      lines
        .filter((line) =>
          ['delivery', 'install', 'teardown', 'fee', 'rental'].includes(line.line_type)
        )
        .reduce((sum, line) => sum + Math.max(line.line_subtotal, 0), 0)
        .toFixed(2)
    );
    const productTaxable = taxRegion?.applies_to_products
      ? lines
          .filter((line) => ['arrangement', 'custom'].includes(line.line_type))
          .reduce((sum, line) => sum + Math.max(line.line_subtotal, 0), 0)
      : 0;
    const serviceTaxable = taxRegion?.applies_to_services
      ? lines
          .filter((line) => ['install', 'teardown', 'fee', 'rental'].includes(line.line_type))
          .reduce((sum, line) => sum + Math.max(line.line_subtotal, 0), 0)
      : 0;
    const deliveryTaxable = taxRegion?.applies_to_delivery
      ? lines
          .filter((line) => line.line_type === 'delivery')
          .reduce((sum, line) => sum + Math.max(line.line_subtotal, 0), 0)
      : 0;
    const taxableBeforeDiscount = productTaxable + serviceTaxable + deliveryTaxable;
    const taxableAmount = Math.max(taxableBeforeDiscount - discountTotal, 0);
    const taxTotal = Number((taxableAmount * (taxRegion?.tax_rate ?? 0)).toFixed(2));
    const grandTotal = Number((subtotal - discountTotal + feeTotal + taxTotal).toFixed(2));

    return {
      subtotal,
      discountTotal,
      feeTotal,
      taxableAmount: Number(taxableAmount.toFixed(2)),
      taxTotal,
      grandTotal,
    };
  }

  buildEstimateLineItems(lines: EstimateBuilderLine[]): Partial<EstimateLineItem>[] {
    return lines.map((line, index) => ({
      arrangement_id: line.arrangement_id,
      line_type: line.line_type,
      name: line.name,
      description: line.description ?? null,
      quantity: line.quantity,
      unit_price: line.unit_price,
      line_subtotal: line.line_subtotal,
      display_order: index,
      pricing_snapshot: {
        line_type: line.line_type,
        arrangement_id: line.arrangement_id,
        arrangement_name: line.arrangement?.name ?? null,
        calculated_cost: line.arrangement?.calculated_cost ?? null,
        suggested_sell_price: line.arrangement?.suggested_sell_price ?? null,
        manual_override_sell_price: line.arrangement?.manual_override_sell_price ?? null,
        applied_unit_price: line.unit_price,
      },
    }));
  }

  buildLineItemSnapshots(
    lines: EstimateBuilderLine[],
    componentsByArrangementId: Record<string, ArrangementComponent[]>
  ): EstimateLineItemComponentSnapshot[][] {
    return lines.map((line) => {
      if (line.line_type !== 'arrangement' || !line.arrangement_id) {
        return [];
      }

      const components = componentsByArrangementId[line.arrangement_id] ?? [];

      return components.map((component) => {
        const item = component.item;
        const quantityPerArrangement = component.quantity_per_arrangement;
        const arrangementQuantity = line.quantity;
        const extendedQuantity = Number((quantityPerArrangement * arrangementQuantity).toFixed(2));
        const wastePercent = component.waste_percent ?? item?.default_waste_percent ?? 0;
        const extendedQuantityWithWaste = Number((extendedQuantity * (1 + wastePercent / 100)).toFixed(2));
        const unitCost = Number((item?.base_unit_cost ?? 0).toFixed(2));
        const extendedCost = Number((extendedQuantity * unitCost).toFixed(2));

        return {
          item_id: item?.item_id ?? null,
          item_name: item?.name ?? 'Catalog Item',
          item_type: item?.item_type ?? 'other',
          unit_type: item?.unit_type ?? 'other',
          color: item?.color ?? null,
          variety: item?.variety ?? null,
          quantity_per_arrangement: Number(quantityPerArrangement.toFixed(2)),
          arrangement_quantity: Number(arrangementQuantity.toFixed(2)),
          extended_quantity: extendedQuantity,
          waste_percent: Number(wastePercent.toFixed(2)),
          extended_quantity_with_waste: extendedQuantityWithWaste,
          unit_cost: unitCost,
          extended_cost: extendedCost,
        } satisfies EstimateLineItemComponentSnapshot;
      });
    });
  }

  buildShoppingList(
    snapshots: EstimateLineItemComponentSnapshot[][],
    defaultPacks: VendorItemPack[]
  ): ShoppingListItem[] {
    const aggregate = new Map<string, ShoppingListItem>();
    const packByItemId = new Map(defaultPacks.map((pack) => [pack.item_id, pack]));

    snapshots.flat().forEach((snapshot) => {
      const itemId = snapshot.item_id ?? `${snapshot.item_name}:${snapshot.unit_type}`;
      const existing = aggregate.get(itemId);

      if (existing) {
        existing.required_units = Number((existing.required_units + snapshot.extended_quantity).toFixed(2));
        existing.required_units_with_waste = Number((existing.required_units_with_waste + snapshot.extended_quantity_with_waste).toFixed(2));
        existing.reserve_units = Number(
          (((existing.reserve_units ?? 0) + snapshot.extended_quantity_with_waste - snapshot.extended_quantity)).toFixed(2)
        );
        existing.total_estimated_cost = Number(
          (((existing.total_estimated_cost ?? 0) + snapshot.extended_cost)).toFixed(2)
        );
        existing.waste_percent = Math.max(existing.waste_percent, snapshot.waste_percent);
        return;
      }

      aggregate.set(itemId, {
        item_id: snapshot.item_id ?? null,
        item_name: snapshot.item_name,
        item_type: snapshot.item_type,
        unit_type: snapshot.unit_type,
        required_units: snapshot.extended_quantity,
        waste_percent: snapshot.waste_percent,
        reserve_units: Number((snapshot.extended_quantity_with_waste - snapshot.extended_quantity).toFixed(2)),
        required_units_with_waste: snapshot.extended_quantity_with_waste,
        total_estimated_cost: snapshot.extended_cost,
      });
    });

    return Array.from(aggregate.values()).map((item) => {
      const pack = item.item_id ? packByItemId.get(item.item_id) : undefined;
      const unitsPerPack = pack?.units_per_pack ?? null;
      const minimumOrderPacks = pack?.minimum_order_packs ?? 1;
      const estimatedPackCost = pack?.pack_price ?? null;
      const requiredPackCount = unitsPerPack
        ? Math.max(Math.ceil(item.required_units_with_waste / unitsPerPack), minimumOrderPacks)
        : null;

      return {
        ...item,
        vendor_id: pack?.vendor_id ?? null,
        vendor_item_pack_id: pack?.vendor_item_pack_id ?? null,
        vendor: pack?.vendor ?? null,
        units_per_pack: unitsPerPack,
        required_pack_count: requiredPackCount,
        estimated_pack_cost: estimatedPackCost,
        total_estimated_cost: requiredPackCount && estimatedPackCost
          ? Number((requiredPackCount * estimatedPackCost).toFixed(2))
          : Number((item.total_estimated_cost ?? 0).toFixed(2)),
        notes: pack
          ? `${pack.purchase_unit_name} from ${pack.vendor?.name ?? 'configured vendor'}`
          : 'No default vendor pack configured for this item.',
      } satisfies ShoppingListItem;
    }).sort((a, b) => a.item_name.localeCompare(b.item_name));
  }

  private createLocalId(): string {
    return `estimate-line-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

