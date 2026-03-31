import { Injectable } from '@angular/core';

import { CatalogItem } from '../../models/catalog-item';
import {
  FloralProposalComponent,
  FloralProposalLineItem,
  FloralProposalLineItemType,
  FloralProposalShoppingListItem,
} from '../../models/floral-proposal';
import { TaxRegion } from '../../models/tax-region';

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
  pack_quantity?: number | null;
  purchase_unit_cost: number;
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
  description?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_storage_path?: string | null;
  image_alt_text?: string | null;
  image_caption?: string | null;
  image_signed_url?: string | null;
  expanded: boolean;
  components: FloralProposalBuilderComponentRow[];
  snapshot?: Record<string, unknown>;
}

export interface FloralProposalRenderPayloadLine {
  display_order: number;
  line_item_type: FloralProposalLineItemType;
  line_type_label: string;
  item_name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_storage_path?: string | null;
  image_signed_url?: string | null;
  image_alt_text?: string | null;
  image_caption?: string | null;
  components: FloralProposalBuilderComponentRow[];
}

export interface FloralProposalRenderPayload {
  template_id?: string | null;
  template_name?: string | null;
  tax_region_id?: string | null;
  tax_region_name?: string | null;
  tax_rate: number;
  default_markup_percent: number;
  labor_percent: number;
  line_items: FloralProposalRenderPayloadLine[];
  shopping_list: FloralProposalShoppingListItem[];
  totals: {
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  };
  breakdown: {
    productsTotal: number;
    laborTotal: number;
    calculatedLaborAmount: number;
    manualLaborTotal: number;
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
      description: null,
      quantity: 1,
      unit_price: 0,
      subtotal: 0,
      image_storage_path: null,
      image_alt_text: null,
      image_caption: null,
      image_signed_url: null,
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
      description: null,
      quantity,
      unit_price: unitPrice,
      subtotal: 0,
      image_storage_path: null,
      image_alt_text: null,
      image_caption: null,
      image_signed_url: null,
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
      description: null,
      quantity,
      unit_price: unitPrice,
      subtotal: 0,
      image_storage_path: null,
      image_alt_text: null,
      image_caption: null,
      image_signed_url: null,
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
      pack_quantity: null,
      purchase_unit_cost: 0,
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
    defaultMarkupPercent: number,
    defaultReservePercent: number
  ): FloralProposalBuilderComponentRow {
    const appliedMarkupPercent = component.applied_markup_percent ?? defaultMarkupPercent;
    const packQuantity = this.getPackQuantity(item);
    const purchaseUnitCost = this.roundCurrency(item.base_unit_cost);
    const compositionBaseUnitCost = packQuantity && this.isPackPricedUnit(item.unit_type)
      ? this.roundCurrency(purchaseUnitCost / packQuantity)
      : purchaseUnitCost;

    return this.recalculateComponent(
      {
        ...component,
        catalog_item_id: item.item_id,
        catalog_item_name: item.name,
        base_unit_cost: compositionBaseUnitCost,
        applied_markup_percent: appliedMarkupPercent,
        reserve_percent: component.reserve_percent || defaultReservePercent,
        pack_quantity: packQuantity,
        purchase_unit_cost: purchaseUnitCost,
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
    const purchaseUnitCost = this.roundCurrency(component.purchase_unit_cost);
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
    const subtotal = this.roundCurrency(sellUnitPrice * quantityPerUnit);

    return {
      ...component,
      quantity_per_unit: quantityPerUnit,
      extended_quantity: extendedQuantity,
      base_unit_cost: baseUnitCost,
      applied_markup_percent: appliedMarkupPercent,
      sell_unit_price: sellUnitPrice,
      subtotal,
      reserve_percent: this.roundNumber(component.reserve_percent, 2),
      pack_quantity: this.normalizePackQuantity(component.pack_quantity, component.unit_type),
      purchase_unit_cost: purchaseUnitCost || baseUnitCost,
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
    taxRegion: TaxRegion | null,
    laborPercent = 0
  ): {
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  } {
    const productsTotal = this.roundCurrency(
      lines
        .filter((line) => line.line_item_type === 'product')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const manualLaborTotal = this.roundCurrency(
      lines
        .filter((line) => line.line_item_type === 'labor')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const calculatedLaborAmount = this.roundCurrency(
      productsTotal * (Math.max(this.roundNumber(laborPercent, 2), 0) / 100)
    );
    const laborTotal = this.roundCurrency(calculatedLaborAmount + manualLaborTotal);
    const feesTotal = this.roundCurrency(
      lines
        .filter((line) => line.line_item_type === 'fee')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const discountsTotal = this.roundCurrency(
      lines
        .filter((line) => line.line_item_type === 'discount')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const subtotal = this.roundCurrency(
      productsTotal + laborTotal + feesTotal + discountsTotal
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
    laborPercent: number;
    shoppingList: FloralProposalShoppingListItem[];
  }): FloralProposalRenderPayload {
    const normalizedLines = args.lines.map((line, index) =>
      this.recalculateLine({
        ...line,
        display_order: index,
      })
    );
    const totals = this.calculateTotals(normalizedLines, args.taxRegion, args.laborPercent);
    const productsTotal = this.roundCurrency(
      normalizedLines
        .filter((line) => line.line_item_type === 'product')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const manualLaborTotal = this.roundCurrency(
      normalizedLines
        .filter((line) => line.line_item_type === 'labor')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const calculatedLaborAmount = this.roundCurrency(
      productsTotal * (Math.max(this.roundNumber(args.laborPercent, 2), 0) / 100)
    );
    const laborTotal = this.roundCurrency(calculatedLaborAmount + manualLaborTotal);
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
      labor_percent: this.roundNumber(args.laborPercent, 2),
      line_items: normalizedLines
        .filter((line) => line.item_name.trim().length > 0)
        .map((line) => ({
          display_order: line.display_order,
          line_item_type: line.line_item_type,
          line_type_label: this.formatLineTypeLabel(line.line_item_type),
          item_name: line.item_name.trim(),
          description: line.description?.trim() || null,
          quantity: line.quantity,
          unit_price: this.roundCurrency(line.unit_price),
          subtotal: this.roundCurrency(line.subtotal),
          image_storage_path: line.image_storage_path ?? null,
          image_signed_url: line.image_signed_url ?? null,
          image_alt_text: line.image_alt_text ?? null,
          image_caption: line.image_caption ?? null,
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
        laborTotal,
        calculatedLaborAmount,
        manualLaborTotal,
        feesTotal,
        discountsTotal,
        subtotal: this.roundCurrency(productsTotal + laborTotal + feesTotal + discountsTotal),
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
      image_storage_path: line.image_storage_path ?? null,
      image_alt_text: line.image_alt_text ?? null,
      image_caption: line.image_caption ?? null,
      image_signed_url: null,
      snapshot: {
        ...(line.snapshot ?? {}),
        expanded: line.expanded,
        description: line.description?.trim() || null,
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
              pack_quantity: component.pack_quantity ?? null,
              purchase_unit_cost: component.purchase_unit_cost,
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

  buildShoppingList(lines: FloralProposalBuilderLine[]): FloralProposalShoppingListItem[] {
    const itemMap = new Map<string, FloralProposalShoppingListItem>();

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
        const reserveTargetUnits = Math.ceil(
          this.roundNumber(requiredUnits * (reservePercent / 100), 2)
        );
        const totalPlusReserve = this.roundNumber(requiredUnits + reserveTargetUnits, 2);
        const packQuantity = this.normalizePackQuantity(
          component.pack_quantity,
          component.unit_type
        );
        const requiredPackCount = packQuantity
          ? Math.max(Math.ceil(totalPlusReserve / packQuantity), 1)
          : null;
        const totalUnitsToBuy = packQuantity
          ? this.roundNumber((requiredPackCount ?? 0) * packQuantity, 2)
          : totalPlusReserve;
        const reserveUnits = this.roundNumber(totalUnitsToBuy - totalPlusReserve, 2);
        const purchaseUnitCost = this.roundCurrency(
          component.purchase_unit_cost || component.base_unit_cost
        );
        const estimatedPackCost = this.getEstimatedPackCost(
          purchaseUnitCost,
          packQuantity,
          component.unit_type
        );
        const totalEstimatedCost = packQuantity
          ? this.roundCurrency((estimatedPackCost ?? 0) * (requiredPackCount ?? 0))
          : this.roundCurrency(purchaseUnitCost * totalUnitsToBuy);
        const existing = itemMap.get(key);

        if (existing) {
          existing.required_units = this.roundNumber(
            existing.required_units + requiredUnits,
            2
          );
          existing.total_plus_reserve = this.roundNumber(
            (existing.total_plus_reserve ?? 0) + totalPlusReserve,
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
          existing.required_pack_count = packQuantity
            ? (existing.required_pack_count ?? 0) + (requiredPackCount ?? 0)
            : null;
          existing.total_estimated_cost = this.roundCurrency(
            (existing.total_estimated_cost ?? 0) + totalEstimatedCost
          );
          existing.estimated_pack_cost = packQuantity
            ? estimatedPackCost
            : existing.estimated_pack_cost ?? null;
          existing.reserve_percent = Math.max(
            existing.reserve_percent,
            reservePercent
          );
          existing.units_per_pack = packQuantity;
          return;
        }

        itemMap.set(key, {
          vendor_id: null,
          vendor_item_pack_id: null,
          catalog_item_id: component.catalog_item_id ?? null,
          item_name: component.catalog_item_name,
          item_type: component.item_type ?? 'other',
          unit_type: component.unit_type ?? 'other',
          required_units: requiredUnits,
          reserve_percent: reservePercent,
          total_plus_reserve: totalPlusReserve,
          reserve_units: reserveUnits,
          total_units_to_buy: totalUnitsToBuy,
          units_per_pack: packQuantity,
          required_pack_count: requiredPackCount,
          estimated_pack_cost: packQuantity ? estimatedPackCost : null,
          total_estimated_cost: totalEstimatedCost,
          notes: null,
        });
      });

    return Array.from(itemMap.values())
      .map((item) => {
        const unitsPerPack = item.units_per_pack ?? null;
        const requiredPackCount = unitsPerPack ? item.required_pack_count ?? null : null;
        const estimatedPackCost = unitsPerPack
          ? this.roundCurrency(item.estimated_pack_cost ?? item.total_estimated_cost ?? 0)
          : null;
        const totalEstimatedCost = this.roundCurrency(item.total_estimated_cost ?? 0);

        return {
          ...item,
          units_per_pack: unitsPerPack,
          required_pack_count: requiredPackCount,
          estimated_pack_cost: estimatedPackCost,
          total_estimated_cost: totalEstimatedCost,
          notes: unitsPerPack
            ? `Buy in packs of ${unitsPerPack}.`
            : 'Buy by the individual unit.',
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
        pack_quantity:
          typeof component.snapshot?.['pack_quantity'] === 'number'
            ? (component.snapshot['pack_quantity'] as number)
            : null,
        purchase_unit_cost:
          typeof component.snapshot?.['purchase_unit_cost'] === 'number'
            ? (component.snapshot['purchase_unit_cost'] as number)
            : component.base_unit_cost,
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
        description: (lineItem.snapshot?.['description'] as string | null) ?? null,
        quantity: lineItem.quantity,
        unit_price: lineItem.unit_price,
        subtotal: lineItem.subtotal,
        image_storage_path: lineItem.image_storage_path ?? null,
        image_alt_text: lineItem.image_alt_text ?? null,
        image_caption: lineItem.image_caption ?? null,
        image_signed_url: null,
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
      case 'labor':
        return 'Labor';
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

  private getPackQuantity(item: CatalogItem): number | null {
    return this.normalizePackQuantity(item.pack_quantity, item.unit_type);
  }

  private normalizePackQuantity(
    packQuantity: number | null | undefined,
    unitType: CatalogItem['unit_type'] | null | undefined
  ): number | null {
    const normalized = Number(packQuantity);
    const isPackTrackedUnit = this.isPackTrackedUnit(unitType);

    if (!isPackTrackedUnit || !Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }

    return this.roundNumber(normalized, 2);
  }

  private isPackTrackedUnit(
    unitType: CatalogItem['unit_type'] | null | undefined
  ): boolean {
    return (
      unitType === 'bunch' ||
      unitType === 'bundle' ||
      unitType === 'box' ||
      unitType === 'stem' ||
      unitType === 'block' ||
      unitType === 'piece'
    );
  }

  private isPackPricedUnit(
    unitType: CatalogItem['unit_type'] | null | undefined
  ): boolean {
    return unitType === 'bunch' || unitType === 'bundle' || unitType === 'box';
  }

  private getEstimatedPackCost(
    purchaseUnitCost: number,
    packQuantity: number | null,
    unitType: CatalogItem['unit_type'] | null | undefined
  ): number | null {
    if (!packQuantity) {
      return null;
    }

    if (this.isPackPricedUnit(unitType)) {
      return this.roundCurrency(purchaseUnitCost);
    }

    return this.roundCurrency(purchaseUnitCost * packQuantity);
  }

  private createLocalId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}


