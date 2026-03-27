import { Injectable } from '@angular/core';

import { CatalogItem } from '../../models/catalog-item';
import {
  FloralProposalComponent,
  FloralProposalLineItem,
  FloralProposalLineItemType,
  FloralProposalShoppingListItem,
} from '../../models/floral-proposal';
import { TaxRegion } from '../../models/tax-region';
import { VendorItemPack } from '../../models/vendor-item-pack';

export interface FloralProposalBuilderComponentRow {
  local_id: string;
  display_order: number;
  catalog_item_id?: string | null;
  catalog_item_name: string;
  quantity_per_unit: number;
  extended_quantity: number;
  base_unit_cost: number;
  applied_markup_percent: number;
  sell_unit_price: number;
  subtotal: number;
  reserve_percent: number;
  item_type?: CatalogItem['item_type'] | null;
  unit_type?: CatalogItem['unit_type'] | null;
  color?: string | null;
  variety?: string | null;
  snapshot?: Record<string, unknown>;
}

export interface FloralProposalBuilderLine {
  local_id: string;
  display_order: number;
  line_item_type: FloralProposalLineItemType;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  description?: string | null;
  image_storage_path?: string | null;
  image_alt_text?: string | null;
  image_caption?: string | null;
  image_signed_url?: string | null;
  notes?: string | null;
  expanded: boolean;
  components: FloralProposalBuilderComponentRow[];
  snapshot?: Record<string, unknown>;
}

export interface FloralProposalRenderPayloadLine {
  display_order: number;
  line_item_type: FloralProposalLineItemType;
  line_type_label: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  description?: string | null;
  image_storage_path?: string | null;
  image_signed_url?: string | null;
  image_alt_text?: string | null;
  image_caption?: string | null;
  notes?: string | null;
  components: FloralProposalBuilderComponentRow[];
}

export interface FloralProposalRenderPayload {
  template_id?: string | null;
  template_name?: string | null;
  tax_region_id?: string | null;
  tax_region_name?: string | null;
  tax_rate: number;
  default_markup_percent: number;
  line_items: FloralProposalRenderPayloadLine[];
  shopping_list: FloralProposalShoppingListItem[];
  totals: {
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  };
  breakdown: {
    productsTotal: number;
    feesTotal: number;
    discountsTotal: number;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class FloralProposalBuilderService {
  createEmptyLine(displayOrder: number): FloralProposalBuilderLine {
    return {
      local_id: this.createLocalId('line'),
      display_order: displayOrder,
      line_item_type: 'product',
      item_name: '',
      quantity: 1,
      unit_price: 0,
      subtotal: 0,
      description: null,
      image_storage_path: null,
      image_alt_text: null,
      image_caption: null,
      image_signed_url: null,
      notes: null,
      expanded: false,
      components: [],
      snapshot: {},
    };
  }

  createFeeLine(
    displayOrder: number,
    itemName = '',
    quantity = 1,
    unitPrice = 0
  ): FloralProposalBuilderLine {
    return this.recalculateLine({
      local_id: this.createLocalId('line'),
      display_order: displayOrder,
      line_item_type: 'fee',
      item_name: itemName,
      quantity,
      unit_price: unitPrice,
      subtotal: 0,
      description: null,
      image_storage_path: null,
      image_alt_text: null,
      image_caption: null,
      image_signed_url: null,
      notes: null,
      expanded: false,
      components: [],
      snapshot: {},
    });
  }

  createDiscountLine(
    displayOrder: number,
    itemName = '',
    quantity = 1,
    unitPrice = 0
  ): FloralProposalBuilderLine {
    return this.recalculateLine({
      local_id: this.createLocalId('line'),
      display_order: displayOrder,
      line_item_type: 'discount',
      item_name: itemName,
      quantity,
      unit_price: unitPrice,
      subtotal: 0,
      description: null,
      image_storage_path: null,
      image_alt_text: null,
      image_caption: null,
      image_signed_url: null,
      notes: null,
      expanded: false,
      components: [],
      snapshot: {},
    });
  }

  createEmptyComponentRow(
    displayOrder: number,
    defaultMarkupPercent: number
  ): FloralProposalBuilderComponentRow {
    return {
      local_id: this.createLocalId('component'),
      display_order: displayOrder,
      catalog_item_id: null,
      catalog_item_name: '',
      quantity_per_unit: 0,
      extended_quantity: 0,
      base_unit_cost: 0,
      applied_markup_percent: defaultMarkupPercent,
      sell_unit_price: 0,
      subtotal: 0,
      reserve_percent: 0,
      item_type: null,
      unit_type: null,
      color: null,
      variety: null,
      snapshot: {},
    };
  }

  applyCatalogItemToComponent(
    component: FloralProposalBuilderComponentRow,
    item: CatalogItem,
    lineQuantity: number,
    defaultMarkupPercent: number
  ): FloralProposalBuilderComponentRow {
    const appliedMarkupPercent =
      component.applied_markup_percent ??
      defaultMarkupPercent;

    return this.recalculateComponent(
      {
        ...component,
        catalog_item_id: item.item_id,
        catalog_item_name: item.name,
        base_unit_cost: item.base_unit_cost,
        applied_markup_percent: appliedMarkupPercent,
        reserve_percent: component.reserve_percent ?? 0,
        item_type: item.item_type,
        unit_type: item.unit_type,
        color: item.color ?? null,
        variety: item.variety ?? null,
        snapshot: {
          color: item.color ?? null,
          variety: item.variety ?? null,
          sku: item.sku ?? null,
        },
      },
      lineQuantity
    );
  }

  recalculateComponent(
    component: FloralProposalBuilderComponentRow,
    lineQuantity: number
  ): FloralProposalBuilderComponentRow {
    const baseUnitCost = this.roundCurrency(component.base_unit_cost);
    const appliedMarkupPercent = this.roundNumber(
      component.applied_markup_percent,
      2
    );
    const quantityPerUnit = Math.max(this.roundNumber(component.quantity_per_unit, 2), 0);
    const normalizedLineQuantity = Math.max(this.roundNumber(lineQuantity, 0), 0);
    const sellUnitPrice = this.roundCurrency(
      baseUnitCost * (1 + appliedMarkupPercent / 100)
    );
    const extendedQuantity = this.roundNumber(
      quantityPerUnit * normalizedLineQuantity,
      2
    );
    const subtotal = this.roundCurrency(sellUnitPrice * extendedQuantity);

    return {
      ...component,
      quantity_per_unit: quantityPerUnit,
      extended_quantity: extendedQuantity,
      base_unit_cost: baseUnitCost,
      applied_markup_percent: appliedMarkupPercent,
      sell_unit_price: sellUnitPrice,
      subtotal,
      reserve_percent: this.roundNumber(component.reserve_percent, 2),
    };
  }

  recalculateLine(
    line: FloralProposalBuilderLine
  ): FloralProposalBuilderLine {
    const quantity = Math.max(this.roundNumber(line.quantity, 0), 0);
    const recalculatedComponents = line.components.map((component, index) =>
      this.recalculateComponent(
        {
          ...component,
          display_order: index,
        },
        quantity
      )
    );

    const componentUnitPrice = this.roundCurrency(
      recalculatedComponents.reduce(
        (sum, component) =>
          sum +
          component.sell_unit_price *
            Math.max(this.roundNumber(component.quantity_per_unit, 2), 0),
        0
      )
    );

    const explicitUnitPrice = this.roundCurrency(line.unit_price);
    const baseUnitPrice =
      line.line_item_type === 'product' ? componentUnitPrice : explicitUnitPrice;
    const unsignedSubtotal = this.roundCurrency(baseUnitPrice * quantity);
    const subtotal =
      line.line_item_type === 'discount' ? -1 * Math.abs(unsignedSubtotal) : unsignedSubtotal;

    return {
      ...line,
      display_order: line.display_order,
      quantity,
      unit_price: baseUnitPrice,
      subtotal,
      components: recalculatedComponents,
    };
  }

  calculateTotals(
    lines: FloralProposalBuilderLine[],
    taxRegion: TaxRegion | null
  ): {
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  } {
    const subtotal = this.roundCurrency(
      lines.reduce((sum, line) => sum + line.subtotal, 0)
    );
    const taxAmount = this.roundCurrency(
      Math.max(subtotal, 0) * (taxRegion?.tax_rate ?? 0)
    );
    const totalAmount = this.roundCurrency(subtotal + taxAmount);

    return {
      subtotal,
      taxAmount,
      totalAmount,
    };
  }

  buildRenderPayload(args: {
    lines: FloralProposalBuilderLine[];
    taxRegion: TaxRegion | null;
    templateId?: string | null;
    templateName?: string | null;
    defaultMarkupPercent: number;
    shoppingList: FloralProposalShoppingListItem[];
  }): FloralProposalRenderPayload {
    const normalizedLines = args.lines.map((line, index) =>
      this.recalculateLine({
        ...line,
        display_order: index,
      })
    );
    const totals = this.calculateTotals(normalizedLines, args.taxRegion);
    const productsTotal = this.roundCurrency(
      normalizedLines
        .filter((line) => line.line_item_type === 'product')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const feesTotal = this.roundCurrency(
      normalizedLines
        .filter((line) => line.line_item_type === 'fee')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const discountsTotal = this.roundCurrency(
      normalizedLines
        .filter((line) => line.line_item_type === 'discount')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );

    return {
      template_id: args.templateId ?? null,
      template_name: args.templateName ?? null,
      tax_region_id: args.taxRegion?.tax_region_id ?? null,
      tax_region_name: args.taxRegion?.name ?? null,
      tax_rate: args.taxRegion?.tax_rate ?? 0,
      default_markup_percent: args.defaultMarkupPercent,
      line_items: normalizedLines
        .filter((line) => line.item_name.trim().length > 0)
        .map((line) => ({
          display_order: line.display_order,
          line_item_type: line.line_item_type,
          line_type_label: this.formatLineTypeLabel(line.line_item_type),
          item_name: line.item_name.trim(),
          quantity: line.quantity,
          unit_price: this.roundCurrency(line.unit_price),
          subtotal: this.roundCurrency(line.subtotal),
          description: line.description ?? null,
          image_storage_path: line.image_storage_path ?? null,
          image_signed_url: line.image_signed_url ?? null,
          image_alt_text: line.image_alt_text ?? null,
          image_caption: line.image_caption ?? null,
          notes: line.notes ?? null,
          components: line.components
            .filter((component) => component.catalog_item_name.trim().length > 0)
            .map((component, componentIndex) => ({
              ...component,
              display_order: componentIndex,
            })),
        })),
      shopping_list: args.shoppingList,
      totals,
      breakdown: {
        productsTotal,
        feesTotal,
        discountsTotal,
        subtotal: this.roundCurrency(productsTotal + feesTotal + discountsTotal),
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
      },
    };
  }

  buildLineItemPayloads(
    lines: FloralProposalBuilderLine[]
  ): Omit<
    FloralProposalLineItem,
    'floral_proposal_line_item_id' | 'floral_proposal_id' | 'created_at' | 'updated_at'
  >[] {
    return lines.map((line, index) => ({
      display_order: index,
      line_item_type: line.line_item_type,
      item_name: line.item_name.trim(),
      quantity: line.quantity,
      unit_price: this.roundCurrency(line.unit_price),
      subtotal: this.roundCurrency(line.subtotal),
      description: line.description ?? null,
      image_storage_path: line.image_storage_path ?? null,
      image_alt_text: line.image_alt_text ?? null,
      image_caption: line.image_caption ?? null,
      image_signed_url: null,
      notes: line.notes ?? null,
      snapshot: {
        ...(line.snapshot ?? {}),
        expanded: line.expanded,
      },
    }));
  }

  buildComponentPayloadMap(
    savedLineItems: FloralProposalLineItem[],
    lines: FloralProposalBuilderLine[]
  ): Record<string, FloralProposalComponent[]> {
    return savedLineItems.reduce<Record<string, FloralProposalComponent[]>>(
      (acc, savedLineItem) => {
        const sourceLine = lines.find(
          (line) => line.display_order === savedLineItem.display_order
        );

        acc[savedLineItem.floral_proposal_line_item_id] = (sourceLine?.components ?? [])
          .filter((component) => component.catalog_item_name.trim().length > 0)
          .map((component, index) => ({
            floral_proposal_component_id: '',
            floral_proposal_line_item_id:
              savedLineItem.floral_proposal_line_item_id,
            display_order: index,
            catalog_item_id: component.catalog_item_id ?? null,
            catalog_item_name: component.catalog_item_name.trim(),
            quantity_per_unit: component.quantity_per_unit,
            extended_quantity: component.extended_quantity,
            base_unit_cost: component.base_unit_cost,
            applied_markup_percent: component.applied_markup_percent,
            sell_unit_price: component.sell_unit_price,
            subtotal: component.subtotal,
            reserve_percent: component.reserve_percent,
            snapshot: {
              ...(component.snapshot ?? {}),
              item_type: component.item_type ?? null,
              unit_type: component.unit_type ?? null,
              color: component.color ?? null,
              variety: component.variety ?? null,
            },
            created_at: '',
            updated_at: '',
          }));

        return acc;
      },
      {}
    );
  }

  buildShoppingList(
    lines: FloralProposalBuilderLine[],
    defaultPacks: VendorItemPack[]
  ): FloralProposalShoppingListItem[] {
    const itemMap = new Map<string, FloralProposalShoppingListItem>();
    const packByItemId = new Map(defaultPacks.map((pack) => [pack.item_id, pack]));

    lines
      .filter((line) => line.line_item_type === 'product')
      .flatMap((line) => line.components)
      .filter((component) => component.catalog_item_name.trim().length > 0)
      .forEach((component) => {
        const key =
          component.catalog_item_id ??
          `${component.catalog_item_name}:${component.unit_type ?? 'other'}`;
        const requiredUnits = this.roundNumber(component.extended_quantity, 2);
        const reservePercent = this.roundNumber(component.reserve_percent, 2);
        const reserveUnits = this.roundNumber(
          requiredUnits * (reservePercent / 100),
          2
        );
        const totalUnitsToBuy = this.roundNumber(requiredUnits + reserveUnits, 2);
        const existing = itemMap.get(key);

        if (existing) {
          existing.required_units = this.roundNumber(
            existing.required_units + requiredUnits,
            2
          );
          existing.reserve_units = this.roundNumber(
            existing.reserve_units + reserveUnits,
            2
          );
          existing.total_units_to_buy = this.roundNumber(
            existing.total_units_to_buy + totalUnitsToBuy,
            2
          );
          existing.total_estimated_cost = this.roundCurrency(
            (existing.total_estimated_cost ?? 0) + component.base_unit_cost * totalUnitsToBuy
          );
          existing.reserve_percent = Math.max(
            existing.reserve_percent,
            reservePercent
          );
          return;
        }

        itemMap.set(key, {
          catalog_item_id: component.catalog_item_id ?? null,
          item_name: component.catalog_item_name,
          item_type: component.item_type ?? 'other',
          unit_type: component.unit_type ?? 'other',
          required_units: requiredUnits,
          reserve_percent: reservePercent,
          reserve_units: reserveUnits,
          total_units_to_buy: totalUnitsToBuy,
          total_estimated_cost: this.roundCurrency(
            component.base_unit_cost * totalUnitsToBuy
          ),
          notes: null,
        });
      });

    return Array.from(itemMap.values())
      .map((item) => {
        const pack = item.catalog_item_id
          ? packByItemId.get(item.catalog_item_id)
          : undefined;
        const unitsPerPack = pack?.units_per_pack ?? null;
        const requiredPackCount = unitsPerPack
          ? Math.max(
              Math.ceil(item.total_units_to_buy / unitsPerPack),
              pack?.minimum_order_packs ?? 1
            )
          : null;
        const estimatedPackCost = pack?.pack_price ?? null;
        const totalEstimatedCost =
          requiredPackCount && estimatedPackCost != null
            ? this.roundCurrency(requiredPackCount * estimatedPackCost)
            : this.roundCurrency(item.total_estimated_cost ?? 0);

        return {
          ...item,
          vendor_id: pack?.vendor_id ?? null,
          vendor_item_pack_id: pack?.vendor_item_pack_id ?? null,
          vendor: pack?.vendor ?? null,
          units_per_pack: unitsPerPack,
          required_pack_count: requiredPackCount,
          estimated_pack_cost: estimatedPackCost,
          total_estimated_cost: totalEstimatedCost,
          notes: pack
            ? `${pack.purchase_unit_name} from ${pack.vendor?.name ?? 'configured vendor'}`
            : 'No default vendor pack configured for this catalog item.',
        };
      })
      .sort((left, right) => left.item_name.localeCompare(right.item_name));
  }

  hydrateBuilderLines(
    lineItems: FloralProposalLineItem[],
    components: FloralProposalComponent[]
  ): FloralProposalBuilderLine[] {
    const componentsByLineItemId = components.reduce<
      Record<string, FloralProposalBuilderComponentRow[]>
    >((acc, component) => {
      const row: FloralProposalBuilderComponentRow = {
        local_id: this.createLocalId('component'),
        display_order: component.display_order,
        catalog_item_id: component.catalog_item_id ?? null,
        catalog_item_name: component.catalog_item_name,
        quantity_per_unit: component.quantity_per_unit,
        extended_quantity: component.extended_quantity,
        base_unit_cost: component.base_unit_cost,
        applied_markup_percent: component.applied_markup_percent,
        sell_unit_price: component.sell_unit_price,
        subtotal: component.subtotal,
        reserve_percent: component.reserve_percent,
        item_type:
          (component.snapshot?.['item_type'] as CatalogItem['item_type']) ?? null,
        unit_type:
          (component.snapshot?.['unit_type'] as CatalogItem['unit_type']) ?? null,
        color: (component.snapshot?.['color'] as string | null) ?? null,
        variety: (component.snapshot?.['variety'] as string | null) ?? null,
        snapshot: component.snapshot ?? {},
      };

      acc[component.floral_proposal_line_item_id] = [
        ...(acc[component.floral_proposal_line_item_id] ?? []),
        row,
      ];
      return acc;
    }, {});

    return lineItems.map((lineItem) =>
      this.recalculateLine({
        local_id: lineItem.floral_proposal_line_item_id,
        display_order: lineItem.display_order,
        line_item_type: lineItem.line_item_type,
        item_name: lineItem.item_name,
        quantity: lineItem.quantity,
        unit_price: lineItem.unit_price,
        subtotal: lineItem.subtotal,
        description: lineItem.description ?? null,
        image_storage_path: lineItem.image_storage_path ?? null,
        image_alt_text: lineItem.image_alt_text ?? null,
        image_caption: lineItem.image_caption ?? null,
        image_signed_url: null,
        notes: lineItem.notes ?? null,
        expanded: false,
        components:
          componentsByLineItemId[lineItem.floral_proposal_line_item_id] ?? [],
        snapshot: lineItem.snapshot ?? {},
      })
    );
  }

  formatLineTypeLabel(lineType: FloralProposalLineItemType): string {
    switch (lineType) {
      case 'product':
        return 'Product';
      case 'fee':
        return 'Fee';
      case 'discount':
        return 'Discount';
      default:
        return lineType;
    }
  }

  private roundCurrency(value: number | null | undefined): number {
    const normalized = Number.isFinite(value) ? Number(value) : 0;
    return Number(normalized.toFixed(2));
  }

  private roundNumber(value: number | null | undefined, digits: number): number {
    const normalized = Number.isFinite(value) ? Number(value) : 0;
    return Number(normalized.toFixed(digits));
  }

  private createLocalId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

