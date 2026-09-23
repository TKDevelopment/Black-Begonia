import { Injectable } from '@angular/core';

import { CatalogItem } from '../../models/catalog-item';
import {
  FloralProposalComponent,
  FloralProposalLineItem,
  FloralProposalLineItemType,
  FloralProposalShoppingListItem,
  LEGACY_LABOR_CONVERSION_KEY,
  LegacyLaborConversionMetadata,
} from '../../models/floral-proposal';
import { Lead } from '../../models/lead';
import { TaxRegion } from '../../models/tax-region';
import {
  EditableProposalLineSnapshot,
  EditableProposalSnapshotV3,
  PROJECT_PROPOSAL_REVISION_SCHEMA_VERSION,
} from '../../models/project-proposal-revision-workspace';

export interface FloralProposalBuilderComponentRow {
  local_id: string;
  display_order: number;
  catalog_item_id?: string | null;
  /** Last resolved catalog identity used to preserve same-item re-selection in the editor. */
  last_catalog_item_id?: string | null;
  catalog_item_name: string;
  quantity_per_unit: number;
  extended_quantity: number;
  base_unit_cost: number;
  applied_markup_percent: number;
  sell_unit_price: number;
  subtotal: number;
  /** Absolute reserve stems/units requested for this contribution. */
  reserve_units: number;
  pack_quantity?: number | null;
  /** Derived cent-valued cost for this row's recorded pack definition. */
  effective_pack_cost?: number | null;
  /** Legacy compatibility metadata. Editable calculations never trust this value. */
  purchase_unit_cost: number;
  item_type?: CatalogItem['item_type'] | null;
  unit_type?: CatalogItem['unit_type'] | null;
  color?: string | null;
  variety?: string | null;
  /** Ephemeral editor state; never persisted in normalized or snapshot payloads. */
  unit_price_input?: string | null;
  unit_price_error?: string | null;
  snapshot?: Record<string, unknown>;
}

export interface ProposalRowUnitCostValidation {
  valid: boolean;
  value: number | null;
  error: string | null;
}

export interface ProposalActualUnitPriceValidation {
  valid: boolean;
  value: number | null;
  reset: boolean;
  error: string | null;
}

export interface FloralProposalBuilderLine {
  local_id: string;
  display_order: number;
  line_item_type: FloralProposalLineItemType;
  item_name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  calculated_unit_price?: number;
  actual_unit_price_override?: number | null;
  /** Ephemeral editor state; never persisted. */
  actual_unit_price_input?: string | null;
  actual_unit_price_error?: string | null;
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
  calculated_unit_price?: number;
  actual_unit_price_override?: number | null;
  subtotal: number;
  image_storage_path?: string | null;
  image_signed_url?: string | null;
  image_alt_text?: string | null;
  image_caption?: string | null;
  components: FloralProposalBuilderComponentRow[];
}

export interface FloralProposalRenderPayload {
  tax_region_id?: string | null;
  tax_region_name?: string | null;
  tax_rate: number;
  default_markup_percent: number;
  /** Legacy read compatibility only; active V3 builders never emit this field. */
  labor_percent?: number;
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
    /** Legacy read compatibility only; active V3 builders never emit this field. */
    calculatedLaborAmount?: number;
    manualLaborTotal: number;
    feesTotal: number;
    discountsTotal: number;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  };
}

export interface ContractTemplateValidationResult {
  mergeData: Record<string, unknown>;
  missingFields: string[];
}

export interface ProjectSnapshotAdaptationResult {
  valid: boolean;
  draft?: EditableProposalSnapshotV3;
  warning?: string | null;
  repairMessage?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FloralProposalBuilderService {
  adaptProjectSnapshot(
    source: Record<string, unknown>,
    financials: {
      subtotal: number;
      taxRate: number;
      taxAmount: number;
      totalAmount: number;
      retainerAmount: number;
      finalBalanceAmount: number;
      retainerDueDate?: string | null;
      finalBalanceDueDate?: string | null;
    }
  ): ProjectSnapshotAdaptationResult {
    const sourceLines = source['line_items'];
    if (!Array.isArray(sourceLines) || sourceLines.length === 0) {
      return {
        valid: false,
        repairMessage: 'The active proposal snapshot does not contain editable line-item data.',
      };
    }

    const lines = sourceLines.map((rawLine, lineIndex) => {
      const line = this.asRecord(rawLine);
      const components = Array.isArray(line['components']) ? line['components'] : [];
      const lineType = this.lineTypeValue(line['line_item_type']);
      const lineSnapshot = this.asRecord(line['snapshot']);
      const recordedUnitPrice = this.roundCurrency(this.numberValue(line['unit_price'], 0));
      return {
        ...(lineType === 'product'
          ? {
              line_item_type: 'product' as const,
              calculated_unit_price: this.roundCurrency(
                this.numberValue(
                  line['calculated_unit_price'] ?? lineSnapshot['calculated_unit_price'],
                  recordedUnitPrice
                )
              ),
              actual_unit_price_override: this.nullableNumber(
                line['actual_unit_price_override'] ?? lineSnapshot['actual_unit_price_override']
              ),
            }
          : { line_item_type: lineType as 'fee' | 'discount' | 'labor' }),
        local_id: this.stringValue(line['local_id']) || this.createLocalId('line'),
        display_order: this.numberValue(line['display_order'], lineIndex),
        item_name: this.stringValue(line['item_name']),
        description: this.nullableString(line['description']),
        quantity: this.numberValue(line['quantity'], 1),
        unit_price: recordedUnitPrice,
        subtotal: this.numberValue(line['subtotal'], 0),
        image_storage_path: this.nullableString(line['image_storage_path']),
        image_alt_text: this.nullableString(line['image_alt_text']),
        image_caption: this.nullableString(line['image_caption']),
        snapshot: lineSnapshot,
        components: components.map((rawComponent, componentIndex) => {
          const component = this.asRecord(rawComponent);
          const componentSnapshot = this.asRecord(component['snapshot']);
          const baseUnitCost = this.roundUnitCost(
            this.numberValue(component['base_unit_cost'], 0)
          );
          const unitType = this.nullableString(
            component['unit_type'] ?? componentSnapshot['unit_type']
          ) as CatalogItem['unit_type'] | null;
          const packQuantity = this.normalizePackQuantity(
            this.nullableNumber(component['pack_quantity'] ?? componentSnapshot['pack_quantity']),
            unitType
          );
          const extendedQuantity = this.numberValue(component['extended_quantity'], 0);
          const legacyReservePercent = this.numberValue(
            component['reserve_percent'] ?? componentSnapshot['reserve_percent'],
            0
          );
          const reserveUnits = this.nullableNumber(
            component['reserve_units'] ?? componentSnapshot['reserve_units']
          ) ?? Math.ceil(
            this.roundNumber(extendedQuantity * (legacyReservePercent / 100), 2)
          );
          return {
            display_order: this.numberValue(component['display_order'], componentIndex),
            catalog_item_id: this.nullableString(component['catalog_item_id']),
            last_catalog_item_id: this.nullableString(component['catalog_item_id']),
            catalog_item_name: this.stringValue(component['catalog_item_name']),
            quantity_per_unit: this.numberValue(component['quantity_per_unit'], 0),
            extended_quantity: extendedQuantity,
            base_unit_cost: baseUnitCost,
            applied_markup_percent: this.numberValue(component['applied_markup_percent'], 0),
            sell_unit_price: this.numberValue(component['sell_unit_price'], 0),
            subtotal: this.numberValue(component['subtotal'], 0),
            reserve_units: Math.max(this.roundNumber(reserveUnits, 0), 0),
            pack_quantity: packQuantity,
            effective_pack_cost: this.deriveEffectivePackCost(baseUnitCost, packQuantity),
            purchase_unit_cost: this.numberValue(
              component['purchase_unit_cost'] ?? componentSnapshot['purchase_unit_cost'],
              this.numberValue(component['base_unit_cost'], 0)
            ),
            item_type: this.nullableString(component['item_type'] ?? componentSnapshot['item_type']),
            unit_type: unitType,
            color: this.nullableString(component['color'] ?? componentSnapshot['color']),
            variety: this.nullableString(component['variety'] ?? componentSnapshot['variety']),
            snapshot: componentSnapshot,
          };
        }),
      };
    }) as EditableProposalLineSnapshot[];

    if (lines.some((line) => !line.item_name.trim())) {
      return {
        valid: false,
        repairMessage: 'The active proposal snapshot contains a line item without a name.',
      };
    }

    const sourceSchema = this.numberValue(source['schema_version'], 1);
    const sourceBreakdown = this.numericRecord(source['breakdown']);
    const sourceLaborPercent = Math.max(
      this.numberValue(source['labor_percent'], 0),
      0
    );
    const markerRecord = this.asRecord(source['legacy_labor_conversion']);
    const markerKey = this.stringValue(markerRecord['conversion_key']);
    const markerStatus = this.stringValue(markerRecord['status']);
    const markerAmount = this.nullableNumber(markerRecord['converted_amount']);
    const taggedLines = lines.filter((line) => {
      const snapshot = this.asRecord(line.snapshot);
      return line.line_item_type === 'labor' &&
        snapshot['conversion_key'] === LEGACY_LABOR_CONVERSION_KEY;
    });

    if (taggedLines.length > 1) {
      return {
        valid: false,
        repairMessage: 'This proposal contains duplicate legacy labor conversion lines. Remove the duplicate before editing or submitting.',
      };
    }
    if (markerKey && markerKey !== LEGACY_LABOR_CONVERSION_KEY) {
      return {
        valid: false,
        repairMessage: 'This proposal contains unsupported legacy labor conversion metadata and needs repair.',
      };
    }

    let legacyLaborConversion: LegacyLaborConversionMetadata | null = null;
    const convertedLines = [...lines];
    const taggedLine = taggedLines[0];
    const taggedAmount = taggedLine ? this.roundCurrency(taggedLine.subtotal) : null;
    const productsTotal = this.roundCurrency(
      lines
        .filter((line) => line.line_item_type === 'product')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const existingLineTotalWithoutConversion = this.roundCurrency(
      lines
        .filter((line) => line !== taggedLine)
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const derivedDifference = this.roundCurrency(
      financials.subtotal - existingLineTotalWithoutConversion
    );
    const recordedCalculatedLabor = this.nullableNumber(
      sourceBreakdown['calculatedLaborAmount']
    );
    const percentCalculatedLabor = this.roundCurrency(
      productsTotal * (sourceLaborPercent / 100)
    );

    if (sourceSchema < PROJECT_PROPOSAL_REVISION_SCHEMA_VERSION || markerKey || taggedLine) {
      const candidates = [
        taggedAmount,
        markerAmount,
        recordedCalculatedLabor,
        sourceLaborPercent > 0 ? derivedDifference : null,
        sourceLaborPercent > 0 ? percentCalculatedLabor : null,
      ].filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
      const resolvedAmount = this.roundCurrency(candidates[0] ?? 0);
      if (candidates.some((candidate) => Math.abs(candidate - resolvedAmount) > 0.01)) {
        return {
          valid: false,
          repairMessage: 'The recorded percentage labor amount does not reconcile within one cent. Repair the draft before editing or submitting.',
        };
      }

      if (markerStatus === 'converted' && markerAmount === null) {
        return {
          valid: false,
          repairMessage: 'The legacy labor conversion marker is missing its converted amount and needs repair.',
        };
      }

      if (resolvedAmount > 0) {
        if (taggedLine && markerAmount !== null && Math.abs(taggedAmount! - markerAmount) > 0.01) {
          return {
            valid: false,
            repairMessage: 'The legacy labor conversion line and marker disagree. Repair the draft before editing or submitting.',
          };
        }
        if (!taggedLine) {
          convertedLines.push({
            local_id: this.createLocalId('legacy-labor'),
            display_order: convertedLines.length,
            line_item_type: 'labor',
            item_name: 'Labor (converted from legacy percentage)',
            description: null,
            quantity: 1,
            unit_price: resolvedAmount,
            subtotal: resolvedAmount,
            image_storage_path: null,
            image_alt_text: null,
            image_caption: null,
            components: [],
            snapshot: {
              origin: 'legacy_labor_percentage_conversion',
              conversion_key: LEGACY_LABOR_CONVERSION_KEY,
              source_labor_percent: sourceLaborPercent ||
                this.numberValue(markerRecord['source_labor_percent'], 0),
              converted_amount: resolvedAmount,
            },
          });
        }
        legacyLaborConversion = {
          conversion_key: LEGACY_LABOR_CONVERSION_KEY,
          source_labor_percent: sourceLaborPercent ||
            this.numberValue(markerRecord['source_labor_percent'], 0),
          converted_amount: resolvedAmount,
          status: 'converted',
        };
      } else if (sourceSchema < PROJECT_PROPOSAL_REVISION_SCHEMA_VERSION || markerKey) {
        legacyLaborConversion = {
          conversion_key: LEGACY_LABOR_CONVERSION_KEY,
          source_labor_percent: sourceLaborPercent ||
            this.numberValue(markerRecord['source_labor_percent'], 0),
          converted_amount: 0,
          status: 'not_required',
        };
      }
    }

    const convertedSubtotal = this.roundCurrency(
      convertedLines.reduce((sum, line) => sum + line.subtotal, 0)
    );
    if (Math.abs(convertedSubtotal - this.roundCurrency(financials.subtotal)) > 0.01) {
      return {
        valid: false,
        repairMessage: 'The editable line items do not reconcile with the recorded subtotal. Repair the draft before editing or submitting.',
      };
    }

    const nestedTaxRegion = this.asRecord(source['tax_region']);
    const taxRate = this.numberValue(
      nestedTaxRegion['tax_rate'] ?? source['tax_rate'],
      financials.taxRate
    );
    const {
      labor_percent: _laborPercent,
      ...sourceWithoutActiveLabor
    } = source;
    const draft: EditableProposalSnapshotV3 = {
      ...sourceWithoutActiveLabor,
      schema_version: PROJECT_PROPOSAL_REVISION_SCHEMA_VERSION,
      proposal_status: 'draft',
      tax_region: {
        tax_region_id: this.nullableString(
          this.asRecord(source['tax_region'])['tax_region_id'] ?? source['tax_region_id']
        ),
        name: this.nullableString(
          this.asRecord(source['tax_region'])['name'] ?? source['tax_region_name']
        ),
        tax_rate: taxRate,
        was_active: this.asRecord(source['tax_region'])['was_active'] !== false,
      },
      default_markup_percent: this.numberValue(source['default_markup_percent'], 300),
      financial_terms: {
        retainer_amount: financials.retainerAmount,
        final_balance_amount: financials.finalBalanceAmount,
        retainer_due_date: financials.retainerDueDate ?? null,
        final_balance_due_date: financials.finalBalanceDueDate ?? null,
      },
      line_items: convertedLines.map((line, index) => ({ ...line, display_order: index })),
      shopping_list: Array.isArray(source['shopping_list'])
        ? (source['shopping_list'] as Record<string, unknown>[])
        : [],
      totals: {
        subtotal: financials.subtotal,
        taxAmount: financials.taxAmount,
        totalAmount: financials.totalAmount,
      },
      breakdown: this.calculateSnapshotBreakdown(convertedLines, financials),
      legacy_labor_conversion: legacyLaborConversion,
    };

    return {
      valid: true,
      draft,
      warning: sourceSchema < PROJECT_PROPOSAL_REVISION_SCHEMA_VERSION
        ? 'This proposal was created with an older snapshot format. Recorded values were preserved and missing optional fields use neutral defaults.'
        : null,
    };
  }

  buildEditableProjectSnapshot(args: {
    renderPayload: FloralProposalRenderPayload;
    lines: FloralProposalBuilderLine[];
    retainerAmount: number;
    finalBalanceAmount: number;
    retainerDueDate?: string | null;
    finalBalanceDueDate?: string | null;
    existing?: Record<string, unknown>;
  }): EditableProposalSnapshotV3 {
    const {
      labor_percent: _laborPercent,
      ...compatibleExisting
    } = args.existing ?? {};
    return {
      ...compatibleExisting,
      schema_version: PROJECT_PROPOSAL_REVISION_SCHEMA_VERSION,
      proposal_status: 'draft',
      tax_region: {
        tax_region_id: args.renderPayload.tax_region_id ?? null,
        name: args.renderPayload.tax_region_name ?? null,
        tax_rate: args.renderPayload.tax_rate,
        was_active: true,
      },
      default_markup_percent: args.renderPayload.default_markup_percent,
      financial_terms: {
        retainer_amount: args.retainerAmount,
        final_balance_amount: args.finalBalanceAmount,
        retainer_due_date: args.retainerDueDate ?? null,
        final_balance_due_date: args.finalBalanceDueDate ?? null,
      },
      line_items: args.lines.map((line, lineIndex) => ({
        ...(line.line_item_type === 'product'
          ? {
              line_item_type: 'product' as const,
              calculated_unit_price: this.roundCurrency(
                line.calculated_unit_price ?? line.unit_price
              ),
              actual_unit_price_override:
                line.actual_unit_price_override === null ||
                line.actual_unit_price_override === undefined
                  ? null
                  : this.roundCurrency(line.actual_unit_price_override),
            }
          : { line_item_type: line.line_item_type as 'fee' | 'discount' | 'labor' }),
        local_id: line.local_id,
        display_order: lineIndex,
        item_name: line.item_name,
        description: line.description ?? null,
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.subtotal,
        image_storage_path: line.image_storage_path ?? null,
        image_alt_text: line.image_alt_text ?? null,
        image_caption: line.image_caption ?? null,
        snapshot: this.sanitizeLineSnapshot(line),
        components: line.components.map((component, componentIndex) => ({
          display_order: componentIndex,
          catalog_item_id: component.catalog_item_id ?? null,
          catalog_item_name: component.catalog_item_name,
          quantity_per_unit: component.quantity_per_unit,
          extended_quantity: component.extended_quantity,
          base_unit_cost: component.base_unit_cost,
          applied_markup_percent: component.applied_markup_percent,
          sell_unit_price: component.sell_unit_price,
          subtotal: component.subtotal,
          reserve_units: component.reserve_units,
           pack_quantity: component.pack_quantity ?? null,
          effective_pack_cost: component.effective_pack_cost ?? null,
          purchase_unit_cost: component.purchase_unit_cost,
          item_type: component.item_type ?? null,
          unit_type: component.unit_type ?? null,
          color: component.color ?? null,
          variety: component.variety ?? null,
          snapshot: {
            ...this.sanitizeComponentSnapshot(component.snapshot),
            reserve_units: component.reserve_units,
            pack_quantity: component.pack_quantity ?? null,
            effective_pack_cost: component.effective_pack_cost ?? null,
            purchase_unit_cost: component.purchase_unit_cost,
          },
        })),
      })),
      shopping_list: args.renderPayload.shopping_list as unknown as Record<string, unknown>[],
      totals: args.renderPayload.totals,
      breakdown: args.renderPayload.breakdown,
      legacy_labor_conversion:
        (args.existing?.['legacy_labor_conversion'] as LegacyLaborConversionMetadata | null) ??
        null,
    };
  }
  validateContractTemplateFieldMap(args: {
    lead: Lead;
    renderPayload: FloralProposalRenderPayload;
    proposalVersion: number;
    requiredFieldMap?: Record<string, unknown> | null;
  }): ContractTemplateValidationResult {
    const mergeData = this.buildContractMergeData(args);
    const missingFields = Object.entries(args.requiredFieldMap ?? {}).flatMap(
      ([fieldId, mapping]) => {
        if (fieldId.startsWith('__')) {
          return [];
        }

        const source = this.resolveTemplateMappingSource(mapping);
        if (!source) {
          return [fieldId];
        }

        const value = this.readMergeDataValue(mergeData, source);
        return this.isMissingMergeValue(value) ? [fieldId] : [];
      }
    );

    return { mergeData, missingFields };
  }

  createEmptyLine(displayOrder: number): FloralProposalBuilderLine {
    return {
      local_id: this.createLocalId('line'),
      display_order: displayOrder,
      line_item_type: 'product',
      item_name: '',
      description: null,
      quantity: 1,
      unit_price: 0,
      calculated_unit_price: 0,
      actual_unit_price_override: null,
      actual_unit_price_input: '0.00',
      actual_unit_price_error: null,
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
      last_catalog_item_id: null,
      catalog_item_name: '',
      quantity_per_unit: 0,
      extended_quantity: 0,
      base_unit_cost: 0,
      applied_markup_percent: defaultMarkupPercent,
      sell_unit_price: 0,
      subtotal: 0,
      reserve_units: 0,
      pack_quantity: null,
      effective_pack_cost: null,
      purchase_unit_cost: 0,
      item_type: null,
      unit_type: null,
      color: null,
      variety: null,
      unit_price_input: null,
      unit_price_error: null,
      snapshot: {},
    };
  }

  applyCatalogItemToComponent(
    component: FloralProposalBuilderComponentRow,
    item: CatalogItem,
    lineQuantity: number,
    defaultMarkupPercent: number,
    defaultReserveUnits: number
  ): FloralProposalBuilderComponentRow {
    const appliedMarkupPercent = component.applied_markup_percent ?? defaultMarkupPercent;
    const packQuantity = this.getPackQuantity(item);
    const purchaseUnitCost = this.roundCurrency(item.base_unit_cost);
    const compositionBaseUnitCost = packQuantity
      ? this.roundUnitCost(purchaseUnitCost / packQuantity)
      : this.roundUnitCost(purchaseUnitCost);

    return this.recalculateComponent(
      {
        ...component,
        catalog_item_id: item.item_id,
        last_catalog_item_id: item.item_id,
        catalog_item_name: item.name,
        base_unit_cost: compositionBaseUnitCost,
        applied_markup_percent: appliedMarkupPercent,
        reserve_units: component.reserve_units || defaultReserveUnits,
        pack_quantity: packQuantity,
        effective_pack_cost: this.deriveEffectivePackCost(
          compositionBaseUnitCost,
          packQuantity
        ),
        purchase_unit_cost: purchaseUnitCost,
        item_type: item.item_type,
        unit_type: item.unit_type,
        color: item.color ?? null,
        variety: item.variety ?? null,
        unit_price_input: String(compositionBaseUnitCost),
        unit_price_error: null,
        snapshot: {
          color: item.color ?? null,
          variety: item.variety ?? null,
          sku: item.sku ?? null,
          pack_quantity: packQuantity,
          effective_pack_cost: this.deriveEffectivePackCost(
            compositionBaseUnitCost,
            packQuantity
          ),
          purchase_unit_cost: purchaseUnitCost,
        },
      },
      lineQuantity
    );
  }

  recalculateComponent(
    component: FloralProposalBuilderComponentRow,
    lineQuantity: number
  ): FloralProposalBuilderComponentRow {
    const baseUnitCost = this.roundUnitCost(component.base_unit_cost);
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

    const packQuantity = this.normalizePackQuantity(
      component.pack_quantity,
      component.unit_type
    );
    const effectivePackCost = this.deriveEffectivePackCost(baseUnitCost, packQuantity);

    return {
      ...component,
      quantity_per_unit: quantityPerUnit,
      extended_quantity: extendedQuantity,
      base_unit_cost: baseUnitCost,
      applied_markup_percent: appliedMarkupPercent,
      sell_unit_price: sellUnitPrice,
      subtotal,
      reserve_units: Math.max(this.roundNumber(component.reserve_units, 0), 0),
      pack_quantity: packQuantity,
      effective_pack_cost: effectivePackCost,
      purchase_unit_cost: purchaseUnitCost,
    };
  }

  validateRowUnitCost(value: unknown): ProposalRowUnitCostValidation {
    const raw = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    if (!raw) {
      return { valid: false, value: null, error: 'Enter a row unit price.' };
    }

    if (!/^\d+(?:\.\d{0,4})?$/.test(raw)) {
      return {
        valid: false,
        value: null,
        error: 'Use a nonnegative price with no more than four decimal places.',
      };
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return { valid: false, value: null, error: 'Enter a valid nonnegative price.' };
    }

    return { valid: true, value: this.roundUnitCost(numeric), error: null };
  }

  validateActualUnitPrice(value: unknown): ProposalActualUnitPriceValidation {
    const raw = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    if (!raw) {
      return { valid: true, value: null, reset: true, error: null };
    }

    if (!/^\d+(?:\.\d{0,2})?$/.test(raw)) {
      return {
        valid: false,
        value: null,
        reset: false,
        error: 'Use a nonnegative price with no more than two decimal places.',
      };
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return {
        valid: false,
        value: null,
        reset: false,
        error: 'Enter a valid nonnegative price.',
      };
    }

    return {
      valid: true,
      value: this.roundCurrency(numeric),
      reset: false,
      error: null,
    };
  }

  applyActualUnitPriceInput(
    line: FloralProposalBuilderLine,
    rawValue: unknown
  ): FloralProposalBuilderLine {
    if (line.line_item_type !== 'product') return line;
    const raw = rawValue === null || rawValue === undefined ? '' : String(rawValue);
    const validation = this.validateActualUnitPrice(raw);

    if (!validation.valid) {
      return {
        ...line,
        actual_unit_price_input: raw,
        actual_unit_price_error: validation.error,
      };
    }

    const recalculated = this.recalculateLine({
      ...line,
      actual_unit_price_override: validation.reset ? null : validation.value,
      actual_unit_price_input: validation.reset ? null : raw,
      actual_unit_price_error: null,
    });

    // Preserve valid in-progress text (for example `2`, `20`, or `20.`) so
    // recalculation does not force `.00` into the field after every keystroke.
    return validation.reset
      ? recalculated
      : { ...recalculated, actual_unit_price_input: raw };
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
    const override = line.line_item_type === 'product'
      ? (line.actual_unit_price_override === null ||
          line.actual_unit_price_override === undefined
          ? null
          : this.roundCurrency(line.actual_unit_price_override))
      : null;
    const baseUnitPrice = line.line_item_type === 'product'
      ? (override ?? componentUnitPrice)
      : explicitUnitPrice;
    const unsignedSubtotal = this.roundCurrency(baseUnitPrice * quantity);
    const subtotal =
      line.line_item_type === 'discount' ? -1 * Math.abs(unsignedSubtotal) : unsignedSubtotal;

    const normalized: FloralProposalBuilderLine = {
      ...line,
      display_order: line.display_order,
      quantity,
      unit_price: baseUnitPrice,
      subtotal,
      components: recalculatedComponents,
    };

    if (line.line_item_type === 'product') {
      return {
        ...normalized,
        calculated_unit_price: componentUnitPrice,
        actual_unit_price_override: override,
        actual_unit_price_input: line.actual_unit_price_error
          ? line.actual_unit_price_input ?? null
          : (override ?? componentUnitPrice).toFixed(2),
      };
    }

    const {
      calculated_unit_price: _calculated,
      actual_unit_price_override: _override,
      actual_unit_price_input: _input,
      actual_unit_price_error: _error,
      ...manualLine
    } = normalized;
    return manualLine;
  }

  calculateTotals(
    lines: FloralProposalBuilderLine[],
    taxRegion: TaxRegion | null
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
    const laborTotal = manualLaborTotal;
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
    const manualLaborTotal = this.roundCurrency(
      normalizedLines
        .filter((line) => line.line_item_type === 'labor')
        .reduce((sum, line) => sum + line.subtotal, 0)
    );
    const laborTotal = manualLaborTotal;
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
          description: line.description?.trim() || null,
          quantity: line.quantity,
          unit_price: this.roundCurrency(line.unit_price),
          ...(line.line_item_type === 'product'
            ? {
                calculated_unit_price: this.roundCurrency(
                  line.calculated_unit_price ?? line.unit_price
                ),
                actual_unit_price_override:
                  line.actual_unit_price_override === null ||
                  line.actual_unit_price_override === undefined
                    ? null
                    : this.roundCurrency(line.actual_unit_price_override),
              }
            : {}),
          subtotal: this.roundCurrency(line.subtotal),
          image_storage_path: line.image_storage_path ?? null,
          image_signed_url: line.image_signed_url ?? null,
          image_alt_text: line.image_alt_text ?? null,
          image_caption: line.image_caption ?? null,
          components: line.components
            .filter((component) => component.catalog_item_name.trim().length > 0)
            .map((component, componentIndex) => ({
              local_id: component.local_id,
              display_order: componentIndex,
              catalog_item_id: component.catalog_item_id ?? null,
              catalog_item_name: component.catalog_item_name,
              quantity_per_unit: component.quantity_per_unit,
              extended_quantity: component.extended_quantity,
              base_unit_cost: component.base_unit_cost,
              applied_markup_percent: component.applied_markup_percent,
              sell_unit_price: component.sell_unit_price,
              subtotal: component.subtotal,
              reserve_units: component.reserve_units,
              pack_quantity: component.pack_quantity ?? null,
              effective_pack_cost: component.effective_pack_cost ?? null,
              purchase_unit_cost: component.purchase_unit_cost,
              item_type: component.item_type ?? null,
              unit_type: component.unit_type ?? null,
              color: component.color ?? null,
              variety: component.variety ?? null,
              snapshot: component.snapshot ?? {},
            })),
        })),
      shopping_list: args.shoppingList,
      totals,
      breakdown: {
        productsTotal,
        laborTotal,
        manualLaborTotal,
        feesTotal,
        discountsTotal,
        subtotal: this.roundCurrency(productsTotal + laborTotal + feesTotal + discountsTotal),
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
      },
    };
  }

  buildContractMergeData(args: {
    lead: Lead;
    renderPayload: FloralProposalRenderPayload;
    proposalVersion: number;
  }): Record<string, unknown> {
    const { lead, renderPayload, proposalVersion } = args;

    return {
      lead: {
        lead_id: lead.lead_id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        full_name: `${lead.first_name} ${lead.last_name}`.trim(),
        partner_first_name: lead.partner_first_name ?? null,
        partner_last_name: lead.partner_last_name ?? null,
        email: lead.email,
        phone: lead.phone ?? null,
        event_type: lead.event_type ?? null,
        service_type: lead.service_type,
        event_date: lead.event_date ?? null,
        ceremony_venue_name: lead.ceremony_venue_name ?? null,
        ceremony_venue_city: lead.ceremony_venue_city ?? null,
        ceremony_venue_state: lead.ceremony_venue_state ?? null,
        reception_venue_name: lead.reception_venue_name ?? null,
        reception_venue_city: lead.reception_venue_city ?? null,
        reception_venue_state: lead.reception_venue_state ?? null,
        budget_range: lead.budget_range ?? null,
        guest_count: lead.guest_count ?? null,
      },
      proposal: {
        version: proposalVersion,
        subtotal: renderPayload.totals.subtotal,
        tax_amount: renderPayload.totals.taxAmount,
        total_amount: renderPayload.totals.totalAmount,
        tax_rate: renderPayload.tax_rate,
        line_items_count: renderPayload.line_items.length,
        tax_region_name: renderPayload.tax_region_name ?? null,
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
      snapshot: this.sanitizeLineSnapshot(line),
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
            reserve_percent: 0,
            reserve_units: component.reserve_units,
            snapshot: {
              ...this.sanitizeComponentSnapshot(component.snapshot),
              reserve_units: component.reserve_units,
              pack_quantity: component.pack_quantity ?? null,
              effective_pack_cost: component.effective_pack_cost ?? null,
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
    type ShoppingGroup = FloralProposalShoppingListItem & { identity_key: string };
    const itemMap = new Map<string, ShoppingGroup>();

    lines
      .filter((line) => line.line_item_type === 'product')
      .flatMap((line) => line.components)
      .filter((component) => component.catalog_item_name.trim().length > 0)
      .forEach((component) => {
        const identityKey = component.catalog_item_id ??
          `${component.catalog_item_name.trim().toLowerCase()}:${component.item_type ?? 'other'}`;
        const requiredUnits = this.roundNumber(component.extended_quantity, 2);
        const reserveTargetUnits = Math.max(
          this.roundNumber(component.reserve_units, 0),
          0
        );
        const totalPlusReserve = this.roundNumber(requiredUnits + reserveTargetUnits, 2);
        const packQuantity = this.normalizePackQuantity(
          component.pack_quantity,
          component.unit_type
        );
        const unitType = component.unit_type ?? 'other';
        const key = `${identityKey}|${unitType}|${packQuantity ?? 'individual'}`;
        const pricingUnitCost = this.roundUnitCost(component.base_unit_cost);
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
          existing.pricing_unit_cost = Math.max(
            existing.pricing_unit_cost ?? 0,
            pricingUnitCost
          );
          existing.requested_reserve_units = this.roundNumber(
            (existing.requested_reserve_units ?? 0) + reserveTargetUnits,
            0
          );
          return;
        }

        itemMap.set(key, {
          identity_key: identityKey,
          catalog_item_id: component.catalog_item_id ?? null,
          item_name: component.catalog_item_name,
          item_type: component.item_type ?? 'other',
          unit_type: component.unit_type ?? 'other',
          required_units: requiredUnits,
          reserve_percent: 0,
          requested_reserve_units: reserveTargetUnits,
          total_plus_reserve: totalPlusReserve,
          reserve_units: 0,
          total_units_to_buy: 0,
          units_per_pack: packQuantity,
          required_pack_count: null,
          pricing_unit_cost: pricingUnitCost,
          estimated_pack_cost: null,
          total_estimated_cost: 0,
          notes: null,
        });
      });

    const identityCounts = Array.from(itemMap.values()).reduce<Record<string, number>>(
      (counts, item) => ({
        ...counts,
        [item.identity_key]: (counts[item.identity_key] ?? 0) + 1,
      }),
      {}
    );

    return Array.from(itemMap.values())
      .map((item) => {
        const unitsPerPack = item.units_per_pack ?? null;
        const totalPlusReserve = this.roundNumber(item.total_plus_reserve ?? 0, 2);
        const pricingUnitCost = this.roundUnitCost(item.pricing_unit_cost ?? 0);
        const requiredPackCount = unitsPerPack
          ? Math.ceil(totalPlusReserve / unitsPerPack)
          : null;
        const totalUnitsToBuy = unitsPerPack
          ? this.roundNumber((requiredPackCount ?? 0) * unitsPerPack, 2)
          : totalPlusReserve;
        const reserveUnits = this.roundNumber(
          Math.max(totalUnitsToBuy - item.required_units, 0),
          2
        );
        const estimatedPackCost = unitsPerPack
          ? this.roundCurrency(pricingUnitCost * unitsPerPack)
          : null;
        const totalEstimatedCost = unitsPerPack
          ? this.roundCurrency((estimatedPackCost ?? 0) * (requiredPackCount ?? 0))
          : this.roundCurrency(pricingUnitCost * totalUnitsToBuy);
        const compatibilityNote = identityCounts[item.identity_key] > 1
          ? ' Separate entry because the recorded pack quantity or unit type differs.'
          : '';
        const { identity_key: _identityKey, ...persistedItem } = item;

        return {
          ...persistedItem,
          total_plus_reserve: totalPlusReserve,
          reserve_units: reserveUnits,
          total_units_to_buy: totalUnitsToBuy,
          units_per_pack: unitsPerPack,
          required_pack_count: requiredPackCount,
          pricing_unit_cost: pricingUnitCost,
          estimated_pack_cost: estimatedPackCost,
          total_estimated_cost: totalEstimatedCost,
          notes: unitsPerPack
            ? `Buy in packs of ${unitsPerPack}.${compatibilityNote}`
            : `Buy by the individual unit.${compatibilityNote}`,
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
        last_catalog_item_id: component.catalog_item_id ?? null,
        catalog_item_name: component.catalog_item_name,
        quantity_per_unit: component.quantity_per_unit,
        extended_quantity: component.extended_quantity,
        base_unit_cost: component.base_unit_cost,
        applied_markup_percent: component.applied_markup_percent,
        sell_unit_price: component.sell_unit_price,
        subtotal: component.subtotal,
        reserve_units:
          typeof component.snapshot?.['reserve_units'] === 'number'
            ? Math.max(this.roundNumber(component.snapshot['reserve_units'] as number, 0), 0)
            : Math.ceil(
                this.roundNumber(
                  component.extended_quantity * (component.reserve_percent / 100),
                  2
                )
              ),
        pack_quantity:
          typeof component.snapshot?.['pack_quantity'] === 'number'
            ? (component.snapshot['pack_quantity'] as number)
            : null,
        effective_pack_cost: null,
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
      row.pack_quantity = this.normalizePackQuantity(row.pack_quantity, row.unit_type);
      row.base_unit_cost = this.roundUnitCost(row.base_unit_cost);
      row.effective_pack_cost = this.deriveEffectivePackCost(
        row.base_unit_cost,
        row.pack_quantity
      );

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
        calculated_unit_price:
          lineItem.line_item_type === 'product'
            ? this.numberValue(
                lineItem.snapshot?.['calculated_unit_price'],
                lineItem.unit_price
              )
            : undefined,
        actual_unit_price_override:
          lineItem.line_item_type === 'product'
            ? this.nullableNumber(
                lineItem.snapshot?.['actual_unit_price_override']
              )
            : undefined,
        actual_unit_price_input:
          lineItem.line_item_type === 'product'
            ? String(
                this.nullableNumber(
                  lineItem.snapshot?.['actual_unit_price_override']
                ) ?? lineItem.unit_price
              )
            : undefined,
        actual_unit_price_error: null,
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
    return Math.round((normalized + Number.EPSILON) * 100) / 100;
  }

  private roundUnitCost(value: number | null | undefined): number {
    const normalized = Number.isFinite(value) ? Math.max(Number(value), 0) : 0;
    return Math.round((normalized + Number.EPSILON) * 10_000) / 10_000;
  }

  private deriveEffectivePackCost(
    rowUnitCost: number,
    packQuantity: number | null
  ): number | null {
    return packQuantity ? this.roundCurrency(rowUnitCost * packQuantity) : null;
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

    return Number.isInteger(normalized) ? normalized : null;
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

  private createLocalId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private nullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private numberValue(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  private nullableNumber(value: unknown): number | null {
    const numeric = Number(value);
    return value !== null && value !== undefined && Number.isFinite(numeric) ? numeric : null;
  }

  private lineTypeValue(value: unknown): FloralProposalLineItemType {
    return value === 'fee' || value === 'discount' || value === 'labor' ? value : 'product';
  }

  private numericRecord(value: unknown): Record<string, number> {
    return Object.entries(this.asRecord(value)).reduce<Record<string, number>>((acc, [key, item]) => {
      const numeric = Number(item);
      if (Number.isFinite(numeric)) acc[key] = numeric;
      return acc;
    }, {});
  }

  private sanitizeLineSnapshot(
    line: FloralProposalBuilderLine
  ): Record<string, unknown> {
    const {
      calculated_unit_price: _calculated,
      actual_unit_price_override: _override,
      actual_unit_price_input: _input,
      actual_unit_price_error: _error,
      ...unrelatedSnapshot
    } = line.snapshot ?? {};

    return {
      ...unrelatedSnapshot,
      expanded: line.expanded,
      description: line.description?.trim() || null,
      ...(line.line_item_type === 'product'
        ? {
            calculated_unit_price: this.roundCurrency(
              line.calculated_unit_price ?? line.unit_price
            ),
            actual_unit_price_override:
              line.actual_unit_price_override === null ||
              line.actual_unit_price_override === undefined
                ? null
                : this.roundCurrency(line.actual_unit_price_override),
          }
        : {}),
    };
  }

  private sanitizeComponentSnapshot(
    snapshot: Record<string, unknown> | undefined
  ): Record<string, unknown> {
    const {
      reserve_percent: _legacyReservePercent,
      reserve_units: _reserveUnits,
      ...unrelatedSnapshot
    } = snapshot ?? {};
    return unrelatedSnapshot;
  }

  private normalizeBreakdown(
    value: Record<string, number>,
    financials: { subtotal: number; taxAmount: number; totalAmount: number }
  ): EditableProposalSnapshotV3['breakdown'] {
    const productsTotal = this.roundCurrency(value['productsTotal'] ?? 0);
    const manualLaborTotal = this.roundCurrency(
      value['manualLaborTotal'] ?? value['laborTotal'] ?? 0
    );
    const feesTotal = this.roundCurrency(value['feesTotal'] ?? 0);
    const discountsTotal = this.roundCurrency(value['discountsTotal'] ?? 0);
    return {
      productsTotal,
      laborTotal: manualLaborTotal,
      manualLaborTotal,
      feesTotal,
      discountsTotal,
      subtotal: this.roundCurrency(value['subtotal'] ?? financials.subtotal),
      taxAmount: this.roundCurrency(value['taxAmount'] ?? financials.taxAmount),
      totalAmount: this.roundCurrency(value['totalAmount'] ?? financials.totalAmount),
    };
  }

  private calculateSnapshotBreakdown(
    lines: EditableProposalLineSnapshot[],
    financials: { subtotal: number; taxAmount: number; totalAmount: number }
  ): EditableProposalSnapshotV3['breakdown'] {
    const sum = (type: FloralProposalLineItemType) => this.roundCurrency(
      lines
        .filter((line) => line.line_item_type === type)
        .reduce((total, line) => total + line.subtotal, 0)
    );
    const productsTotal = sum('product');
    const manualLaborTotal = sum('labor');
    const feesTotal = sum('fee');
    const discountsTotal = sum('discount');
    return {
      productsTotal,
      laborTotal: manualLaborTotal,
      manualLaborTotal,
      feesTotal,
      discountsTotal,
      subtotal: this.roundCurrency(financials.subtotal),
      taxAmount: this.roundCurrency(financials.taxAmount),
      totalAmount: this.roundCurrency(financials.totalAmount),
    };
  }

  private resolveTemplateMappingSource(mapping: unknown): string | null {
    if (typeof mapping === 'string' && mapping.trim().length) {
      return mapping.trim();
    }

    if (
      mapping &&
      typeof mapping === 'object' &&
      'source' in mapping &&
      typeof mapping.source === 'string' &&
      mapping.source.trim().length
    ) {
      return mapping.source.trim();
    }

    return null;
  }

  private readMergeDataValue(
    mergeData: Record<string, unknown>,
    sourcePath: string
  ): unknown {
    return sourcePath
      .split('.')
      .reduce<unknown>(
        (value, segment) =>
          value && typeof value === 'object' && segment in (value as Record<string, unknown>)
            ? (value as Record<string, unknown>)[segment]
            : undefined,
        mergeData
      );
  }

  private isMissingMergeValue(value: unknown): boolean {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    return false;
  }
}


