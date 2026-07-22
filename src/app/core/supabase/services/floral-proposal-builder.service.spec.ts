import { TestBed } from '@angular/core/testing';

import { CatalogItem } from '../../models/catalog-item';
import {
  FloralProposalComponent,
  FloralProposalLineItem,
} from '../../models/floral-proposal';
import { TaxRegion } from '../../models/tax-region';
import {
  FloralProposalBuilderComponentRow,
  FloralProposalBuilderLine,
  FloralProposalBuilderService,
} from './floral-proposal-builder.service';

describe('FloralProposalBuilderService', () => {
  let service: FloralProposalBuilderService;

  const taxRegion: TaxRegion = {
    tax_region_id: 'tax-region-test-001',
    name: 'Austin Test Tax',
    authority_name: 'Test Authority',
    tax_rate: 0.08,
    applies_to_products: true,
    applies_to_services: true,
    applies_to_delivery: true,
    is_active: true,
    created_at: '2026-06-02T12:00:00.000Z',
    updated_at: '2026-06-02T12:00:00.000Z',
  };

  const catalogItem: CatalogItem = {
    item_id: 'catalog-rose-001',
    name: 'Garden Rose',
    item_type: 'flower',
    unit_type: 'bunch',
    pack_quantity: 10,
    color: 'Blush',
    variety: 'Juliet',
    sku: 'ROSE-JULIET',
    base_unit_cost: 30,
    default_waste_percent: 10,
    is_active: true,
    created_at: '2026-06-02T12:00:00.000Z',
    updated_at: '2026-06-02T12:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FloralProposalBuilderService);
  });

  it('creates empty product lines and component rows with deterministic defaults', () => {
    const line = service.createEmptyLine(2);
    const component = service.createEmptyComponentRow(3, 35);

    expect(line.local_id).toContain('line-');
    expect(line.display_order).toBe(2);
    expect(line.line_item_type).toBe('product');
    expect(line.quantity).toBe(1);
    expect(line.unit_price).toBe(0);
    expect(line.components).toEqual([]);
    expect(line.expanded).toBeFalse();

    expect(component.local_id).toContain('component-');
    expect(component.display_order).toBe(3);
    expect(component.catalog_item_id).toBeNull();
    expect(component.applied_markup_percent).toBe(35);
    expect(component.quantity_per_unit).toBe(0);
    expect(component.purchase_unit_cost).toBe(0);
  });

  it('applies catalog item data to component rows and prices pack-based items per unit', () => {
    const component = {
      ...service.createEmptyComponentRow(0, 25),
      quantity_per_unit: 2,
    };

    const result = service.applyCatalogItemToComponent(
      component,
      catalogItem,
      3,
      25,
      12
    );

    expect(result.catalog_item_id).toBe(catalogItem.item_id);
    expect(result.catalog_item_name).toBe('Garden Rose');
    expect(result.base_unit_cost).toBe(3);
    expect(result.purchase_unit_cost).toBe(30);
    expect(result.pack_quantity).toBe(10);
    expect(result.effective_pack_cost).toBe(30);
    expect(result.applied_markup_percent).toBe(25);
    expect(result.sell_unit_price).toBe(3.75);
    expect(result.quantity_per_unit).toBe(2);
    expect(result.extended_quantity).toBe(6);
    expect(result.subtotal).toBe(7.5);
    expect(result.reserve_percent).toBe(12);
    expect(result.snapshot).toEqual(jasmine.objectContaining({
      color: 'Blush',
      variety: 'Juliet',
      sku: 'ROSE-JULIET',
      pack_quantity: 10,
      effective_pack_cost: 30,
    }));
  });

  it('recalculates product, fee, and discount line subtotals', () => {
    const product = service.recalculateLine({
      ...service.createEmptyLine(0),
      quantity: 3,
      unit_price: 999,
      components: [
        {
          ...service.createEmptyComponentRow(0, 20),
          catalog_item_name: 'Rose',
          quantity_per_unit: 2,
          base_unit_cost: 4,
          purchase_unit_cost: 4,
          applied_markup_percent: 50,
        },
        {
          ...service.createEmptyComponentRow(1, 20),
          catalog_item_name: 'Ribbon',
          quantity_per_unit: 1.5,
          base_unit_cost: 2,
          purchase_unit_cost: 2,
          applied_markup_percent: 25,
        },
      ],
    });
    const fee = service.createFeeLine(1, 'Delivery', 2, 35);
    const discount = service.createDiscountLine(2, 'Courtesy Credit', 1, 15);

    expect(product.quantity).toBe(3);
    expect(product.components[0].display_order).toBe(0);
    expect(product.components[0].extended_quantity).toBe(6);
    expect(product.unit_price).toBe(15.75);
    expect(product.subtotal).toBe(47.25);

    expect(fee.line_item_type).toBe('fee');
    expect(fee.subtotal).toBe(70);

    expect(discount.line_item_type).toBe('discount');
    expect(discount.subtotal).toBe(-15);
  });

  it('calculates totals with product labor, manual labor, fees, discounts, and tax', () => {
    const lines: FloralProposalBuilderLine[] = [
      { ...service.createEmptyLine(0), line_item_type: 'product', subtotal: 100 },
      { ...service.createFeeLine(1, 'Setup Labor', 1, 20), line_item_type: 'labor' },
      service.createFeeLine(2, 'Delivery', 1, 10),
      service.createDiscountLine(3, 'Courtesy Credit', 1, 5),
    ];

    const totals = service.calculateTotals(lines, taxRegion, 15);

    expect(totals.subtotal).toBe(140);
    expect(totals.taxAmount).toBe(11.2);
    expect(totals.totalAmount).toBe(151.2);
  });

  it('builds render payloads with normalized lines, filtered blanks, totals, and breakdowns', () => {
    const blankLine = service.createEmptyLine(0);
    const product = service.recalculateLine({
      ...service.createEmptyLine(1),
      item_name: '  Ceremony Meadow  ',
      description: '  Lush aisle florals  ',
      quantity: 2,
      components: [
        {
          ...service.createEmptyComponentRow(0, 20),
          catalog_item_name: ' Garden Rose ',
          quantity_per_unit: 5,
          base_unit_cost: 4,
          purchase_unit_cost: 4,
          applied_markup_percent: 50,
        },
        {
          ...service.createEmptyComponentRow(1, 20),
          catalog_item_name: '   ',
          quantity_per_unit: 3,
          base_unit_cost: 1,
          purchase_unit_cost: 1,
        },
      ],
      image_storage_path: 'proposal-images/meadow.jpg',
      image_signed_url: 'https://example.test/meadow.jpg',
      image_alt_text: 'Meadow arrangement',
      image_caption: 'Ceremony meadow',
    });
    const fee = service.createFeeLine(2, 'Delivery', 1, 25);

    const payload = service.buildRenderPayload({
      lines: [blankLine, product, fee],
      taxRegion,
      defaultMarkupPercent: 30,
      laborPercent: 10,
      shoppingList: [],
    });

    expect(payload.tax_region_name).toBe('Austin Test Tax');
    expect(payload.line_items.length).toBe(2);
    expect(payload.line_items[0]).toEqual(
      jasmine.objectContaining({
        display_order: 1,
        line_item_type: 'product',
        line_type_label: 'Product',
        item_name: 'Ceremony Meadow',
        description: 'Lush aisle florals',
        quantity: 2,
        unit_price: 33.6,
        subtotal: 67.2,
      })
    );
    expect(payload.line_items[0].components.length).toBe(1);
    expect(payload.line_items[1].line_type_label).toBe('Fee');
    expect(payload.line_items[0] as unknown as Record<string, unknown>).not.toEqual(
      jasmine.objectContaining({
        template_id: jasmine.anything(),
        template_name: jasmine.anything(),
      })
    );
    expect(payload as unknown as Record<string, unknown>).not.toEqual(
      jasmine.objectContaining({
        template_id: jasmine.anything(),
        template_name: jasmine.anything(),
      })
    );
    expect(payload.totals).toEqual({
      subtotal: 98.92,
      taxAmount: 7.91,
      totalAmount: 106.83,
    });
    expect(payload.breakdown).toEqual(
      jasmine.objectContaining({
        productsTotal: 67.2,
        calculatedLaborAmount: 6.72,
        laborTotal: 6.72,
        feesTotal: 25,
        discountsTotal: 0,
      })
    );
  });

  it('builds line item payloads and component payload maps for persistence', () => {
    const line = service.recalculateLine({
      ...service.createEmptyLine(4),
      item_name: '  Personal Flowers  ',
      description: '  Bridal bouquet and boutonniere  ',
      quantity: 1,
      expanded: true,
      snapshot: { source: 'builder' },
      components: [
        {
          ...service.createEmptyComponentRow(0, 20),
          catalog_item_id: 'catalog-rose-001',
          catalog_item_name: ' Garden Rose ',
          quantity_per_unit: 12,
          base_unit_cost: 4,
          purchase_unit_cost: 4,
          applied_markup_percent: 50,
          reserve_percent: 10,
          item_type: 'flower',
          unit_type: 'stem',
          color: 'Blush',
          variety: 'Juliet',
        },
        {
          ...service.createEmptyComponentRow(1, 20),
          catalog_item_name: ' ',
        },
      ],
    });
    const savedLine: FloralProposalLineItem = {
      floral_proposal_line_item_id: 'saved-line-001',
      floral_proposal_id: 'proposal-test-001',
      display_order: 0,
      line_item_type: 'product',
      item_name: 'Personal Flowers',
      quantity: 1,
      unit_price: line.unit_price,
      subtotal: line.subtotal,
      image_storage_path: null,
      image_alt_text: null,
      image_caption: null,
      snapshot: {},
      created_at: '2026-06-02T12:00:00.000Z',
      updated_at: '2026-06-02T12:00:00.000Z',
    };

    const linePayloads = service.buildLineItemPayloads([line]);
    const componentMap = service.buildComponentPayloadMap([savedLine], [
      { ...line, display_order: 0 },
    ]);

    expect(linePayloads[0]).toEqual(
      jasmine.objectContaining({
        display_order: 0,
        item_name: 'Personal Flowers',
        quantity: 1,
        unit_price: 72,
        subtotal: 72,
      })
    );
    expect(linePayloads[0].snapshot).toEqual({
      source: 'builder',
      expanded: true,
      description: 'Bridal bouquet and boutonniere',
    });
    expect(componentMap['saved-line-001'].length).toBe(1);
    expect(componentMap['saved-line-001'][0]).toEqual(
      jasmine.objectContaining({
        floral_proposal_line_item_id: 'saved-line-001',
        display_order: 0,
        catalog_item_name: 'Garden Rose',
        quantity_per_unit: 12,
        extended_quantity: 12,
        sell_unit_price: 6,
        subtotal: 72,
      })
    );
    expect(componentMap['saved-line-001'][0].snapshot).toEqual(
      jasmine.objectContaining({
        purchase_unit_cost: 4,
        effective_pack_cost: null,
        item_type: 'flower',
        unit_type: 'stem',
        color: 'Blush',
        variety: 'Juliet',
      })
    );
  });

  it('validates contract template field maps and reports missing fields', () => {
    const renderPayload = service.buildRenderPayload({
      lines: [
        service.recalculateLine({
          ...service.createEmptyLine(0),
          item_name: 'Reception Install',
          quantity: 2,
          components: [
            {
              ...service.createEmptyComponentRow(0, 20),
              catalog_item_name: 'Smilax',
              quantity_per_unit: 3,
              base_unit_cost: 8,
              purchase_unit_cost: 8,
              applied_markup_percent: 25,
            },
          ],
        }),
      ],
      taxRegion,
      defaultMarkupPercent: 30,
      laborPercent: 15,
      shoppingList: [],
    });

    const result = service.validateContractTemplateFieldMap({
      lead: {
        lead_id: 'lead-test-001',
        event_type: 'wedding',
        service_type: 'full service',
        first_name: 'Avery',
        last_name: 'Bloom',
        email: 'avery@example.test',
        phone: '555-0100',
        preferred_contact_method: 'email',
        event_date: '2026-10-24',
        ceremony_venue_name: 'Test Garden',
        ceremony_venue_city: 'Austin',
        ceremony_venue_state: 'TX',
        ceremony_start_time: null,
        reception_venue_name: 'Test Hall',
        reception_venue_city: 'Austin',
        reception_venue_state: 'TX',
        reception_start_time: null,
        event_start_time: null,
        budget_range: '$5,000-$7,500',
        guest_count: 80,
        inquiry_message: null,
        source: 'website',
        status: 'nurturing',
        assigned_user_id: null,
        decline_reason: null,
        converted_project_id: null,
        converted_primary_contact_id: null,
        converted_at: null,
        declined_at: null,
        last_contacted_at: null,
        created_at: '2026-06-02T12:00:00.000Z',
        updated_at: '2026-06-02T12:00:00.000Z',
        consultation_scheduled_at: null,
        consultation_completed_at: null,
        planner_name: null,
        planner_phone: null,
        planner_email: null,
        partner_first_name: 'Jordan',
        partner_last_name: 'Reed',
      },
      renderPayload,
      proposalVersion: 4,
      requiredFieldMap: {
        customer_name: 'lead.full_name',
        customer_email: 'lead.email',
        proposal_total: { source: 'proposal.total_amount', provider_field_id: 'total_due' },
        missing_guest_count: 'lead.missing_value',
      },
    });

    expect(result.mergeData).toEqual(
      jasmine.objectContaining({
        lead: jasmine.objectContaining({
          full_name: 'Avery Bloom',
          email: 'avery@example.test',
        }),
        proposal: jasmine.objectContaining({
          version: 4,
          total_amount: renderPayload.totals.totalAmount,
        }),
      })
    );
    expect(result.missingFields).toEqual(['missing_guest_count']);
  });

  it('builds and aggregates shopping list items with reserve and pack math', () => {
    const firstLine = service.recalculateLine({
      ...service.createEmptyLine(0),
      quantity: 2,
      components: [
        {
          ...service.createEmptyComponentRow(0, 20),
          catalog_item_id: 'catalog-rose-001',
          catalog_item_name: 'Garden Rose',
          quantity_per_unit: 6,
          extended_quantity: 12,
          base_unit_cost: 3,
          purchase_unit_cost: 30,
          applied_markup_percent: 20,
          reserve_percent: 10,
          pack_quantity: 10,
          item_type: 'flower',
          unit_type: 'bunch',
        },
      ],
    });
    const secondLine = service.recalculateLine({
      ...service.createEmptyLine(1),
      quantity: 1,
      components: [
        {
          ...service.createEmptyComponentRow(0, 20),
          catalog_item_id: 'catalog-rose-001',
          catalog_item_name: 'Garden Rose',
          quantity_per_unit: 5,
          extended_quantity: 5,
          base_unit_cost: 3,
          purchase_unit_cost: 30,
          applied_markup_percent: 20,
          reserve_percent: 10,
          pack_quantity: 10,
          item_type: 'flower',
          unit_type: 'bunch',
        },
      ],
    });

    const shoppingList = service.buildShoppingList([firstLine, secondLine]);

    expect(shoppingList.length).toBe(1);
    expect(shoppingList[0]).toEqual(
      jasmine.objectContaining({
        catalog_item_id: 'catalog-rose-001',
        item_name: 'Garden Rose',
        required_units: 17,
        reserve_percent: 10,
        total_plus_reserve: 20,
        reserve_units: 3,
        total_units_to_buy: 20,
        units_per_pack: 10,
        required_pack_count: 2,
        pricing_unit_cost: 3,
        estimated_pack_cost: 30,
        total_estimated_cost: 60,
        notes: 'Buy in packs of 10.',
      })
    );
  });

  it('hydrates persisted line items and components back into builder lines', () => {
    const lineItem: FloralProposalLineItem = {
      floral_proposal_line_item_id: 'line-persisted-001',
      floral_proposal_id: 'proposal-test-001',
      display_order: 2,
      line_item_type: 'product',
      item_name: 'Reception Install',
      quantity: 2,
      unit_price: 100,
      subtotal: 200,
      image_storage_path: 'proposal-images/install.jpg',
      image_alt_text: 'Reception install',
      image_caption: 'A hanging installation',
      snapshot: {
        description: 'Suspended greenery',
        expanded: true,
      },
      created_at: '2026-06-02T12:00:00.000Z',
      updated_at: '2026-06-02T12:00:00.000Z',
    };
    const component: FloralProposalComponent = {
      floral_proposal_component_id: 'component-persisted-001',
      floral_proposal_line_item_id: lineItem.floral_proposal_line_item_id,
      display_order: 0,
      catalog_item_id: 'catalog-smilax-001',
      catalog_item_name: 'Smilax',
      quantity_per_unit: 3,
      extended_quantity: 6,
      base_unit_cost: 8,
      applied_markup_percent: 50,
      sell_unit_price: 12,
      subtotal: 36,
      reserve_percent: 15,
      snapshot: {
        pack_quantity: 5,
        purchase_unit_cost: 40,
        effective_pack_cost: 40,
        item_type: 'greenery',
        unit_type: 'bundle',
        color: 'Green',
        variety: 'Smilax',
      },
      created_at: '2026-06-02T12:00:00.000Z',
      updated_at: '2026-06-02T12:00:00.000Z',
    };

    const hydrated = service.hydrateBuilderLines([lineItem], [component]);

    expect(hydrated.length).toBe(1);
    expect(hydrated[0]).toEqual(
      jasmine.objectContaining({
        local_id: 'line-persisted-001',
        display_order: 2,
        item_name: 'Reception Install',
        description: 'Suspended greenery',
        quantity: 2,
        unit_price: 36,
        subtotal: 72,
        image_storage_path: 'proposal-images/install.jpg',
        image_signed_url: null,
        expanded: false,
      })
    );
    expect(hydrated[0].components[0]).toEqual(
      jasmine.objectContaining({
        catalog_item_name: 'Smilax',
        quantity_per_unit: 3,
        extended_quantity: 6,
        base_unit_cost: 8,
        purchase_unit_cost: 40,
        pack_quantity: 5,
        item_type: 'greenery',
        unit_type: 'bundle',
        color: 'Green',
        variety: 'Smilax',
      })
    );
  });

  it('formats supported line type labels', () => {
    expect(service.formatLineTypeLabel('product')).toBe('Product');
    expect(service.formatLineTypeLabel('labor')).toBe('Labor');
    expect(service.formatLineTypeLabel('fee')).toBe('Fee');
    expect(service.formatLineTypeLabel('discount')).toBe('Discount');
  });

  it('validates row costs independently from cent-rounded financial outputs', () => {
    expect(service.validateRowUnitCost('2.9167')).toEqual({
      valid: true,
      value: 2.9167,
      error: null,
    });
    expect(service.validateRowUnitCost('0').value).toBe(0);
    for (const invalid of ['', '-1', '1.23456', 'Infinity', 'not-a-number']) {
      expect(service.validateRowUnitCost(invalid).valid).withContext(invalid).toBeFalse();
    }

    const row = service.recalculateComponent({
      ...service.createEmptyComponentRow(0, 25),
      catalog_item_name: 'Precision Rose',
      base_unit_cost: 2.9167,
      quantity_per_unit: 3,
      pack_quantity: 12,
      unit_type: 'stem',
    }, 2);
    expect(row.base_unit_cost).toBe(2.9167);
    expect(row.effective_pack_cost).toBe(35);
    expect(row.sell_unit_price).toBe(3.65);
    expect(row.subtotal).toBe(10.95);
  });

  it('aggregates compatible mixed-price rows once at the highest price and separates incompatible packs', () => {
    const line = (price: number, pack: number, order: number) => service.recalculateLine({
      ...service.createEmptyLine(order),
      item_name: `Arrangement ${order}`,
      quantity: 1,
      components: [{
        ...service.createEmptyComponentRow(0, 20),
        catalog_item_id: 'catalog-mixed',
        catalog_item_name: 'Mixed Rose',
        quantity_per_unit: 6,
        base_unit_cost: price,
        pack_quantity: pack,
        unit_type: 'stem',
        item_type: 'flower',
      }],
    });

    const items = service.buildShoppingList([line(3, 10, 0), line(4, 10, 1), line(5, 12, 2)]);
    expect(items.length).toBe(2);
    const compatible = items.find((item) => item.units_per_pack === 10)!;
    expect(compatible.required_units).toBe(12);
    expect(compatible.required_pack_count).toBe(2);
    expect(compatible.pricing_unit_cost).toBe(4);
    expect(compatible.estimated_pack_cost).toBe(40);
    expect(compatible.total_estimated_cost).toBe(80);
    expect(compatible.notes).toContain('Separate entry');
  });

  it('derives editable legacy effective pack cost instead of trusting stale purchase metadata', () => {
    const result = service.adaptProjectSnapshot({
      schema_version: 2,
      line_items: [{
        item_name: 'Legacy arrangement',
        line_item_type: 'product',
        quantity: 1,
        components: [{
          catalog_item_name: 'Legacy Rose',
          base_unit_cost: 4.1255,
          pack_quantity: 10,
          purchase_unit_cost: 30,
          unit_type: 'stem',
        }],
      }],
    }, { subtotal: 0, taxRate: 0, taxAmount: 0, totalAmount: 0, retainerAmount: 0, finalBalanceAmount: 0 });

    const component = result.draft!.line_items[0].components[0];
    expect(component.base_unit_cost).toBe(4.1255);
    expect(component.purchase_unit_cost).toBe(30);
    expect(component.effective_pack_cost).toBe(41.26);
  });

  it('adapts legacy snapshots losslessly without repricing retired catalog values', () => {
    const result = service.adaptProjectSnapshot({
      tax_region_id: 'inactive-tax', tax_region_name: 'Recorded County', tax_rate: .07,
      default_markup_percent: 275, labor_percent: 12,
      line_items: [{
        display_order: 0, line_item_type: 'product', item_name: 'Retired Rose Arrangement',
        quantity: 2, unit_price: 155, subtotal: 310,
        components: [{ catalog_item_id: 'retired-rose', catalog_item_name: 'Legacy Rose', quantity_per_unit: 10,
          extended_quantity: 20, base_unit_cost: 3.25, applied_markup_percent: 275,
          sell_unit_price: 12.19, subtotal: 243.8, reserve_percent: 10 }],
      }],
    }, { subtotal: 310, taxRate: .07, taxAmount: 21.7, totalAmount: 331.7, retainerAmount: 99.51, finalBalanceAmount: 331.7 });

    expect(result.valid).toBeTrue();
    expect(result.warning).toContain('older snapshot format');
    expect(result.draft?.tax_region).toEqual(jasmine.objectContaining({ tax_region_id: 'inactive-tax', tax_rate: .07 }));
    expect(result.draft?.line_items[0]).toEqual(jasmine.objectContaining({ unit_price: 155, subtotal: 310 }));
    expect(result.draft?.line_items[0].components[0]).toEqual(jasmine.objectContaining({
      catalog_item_id: 'retired-rose', base_unit_cost: 3.25, sell_unit_price: 12.19, subtotal: 243.8,
    }));
  });

  it('rejects snapshots missing editable core data', () => {
    const financials = { subtotal: 0, taxRate: 0, taxAmount: 0, totalAmount: 0, retainerAmount: 0, finalBalanceAmount: 0 };
    expect(service.adaptProjectSnapshot({}, financials).valid).toBeFalse();
    expect(service.adaptProjectSnapshot({ line_items: [{ item_name: '' }] }, financials).valid).toBeFalse();
  });

  it('round-trips all supported v2 editable values', () => {
    const adapted = service.adaptProjectSnapshot({
      schema_version: 2,
      tax_region: { tax_region_id: 'tax-1', name: 'County', tax_rate: .06, was_active: false },
      default_markup_percent: 300, labor_percent: 15,
      line_items: [{ local_id: 'line-1', display_order: 0, line_item_type: 'fee', item_name: 'Delivery', description: 'Recorded', quantity: 1, unit_price: 50, subtotal: 50, components: [] }],
      shopping_list: [], breakdown: { feesTotal: 50 },
    }, { subtotal: 50, taxRate: .06, taxAmount: 3, totalAmount: 53, retainerAmount: 15.9, finalBalanceAmount: 53 });
    expect(adapted.valid).toBeTrue();
    expect(adapted.warning).toBeNull();
    expect(adapted.draft).toEqual(jasmine.objectContaining({ schema_version: 2, default_markup_percent: 300, labor_percent: 15 }));
    expect(adapted.draft?.tax_region.was_active).toBeFalse();
    expect(adapted.draft?.line_items[0].description).toBe('Recorded');
  });

  it('recalculates a representative 100-line proposal within the 200 ms edit budget', () => {
    const lines = Array.from({ length: 100 }, (_, index) => ({
      ...service.createEmptyLine(index), item_name: `Arrangement ${index + 1}`, quantity: 2,
      unit_price: 100, subtotal: 200,
    }));
    const samples = Array.from({ length: 20 }, () => {
      const started = performance.now();
      service.calculateTotals(lines, { tax_region_id: 'tax', name: 'Tax', tax_rate: .06, applies_to_products: true, applies_to_services: true, applies_to_delivery: true, is_active: true, created_at: '', updated_at: '' }, 10);
      return performance.now() - started;
    });
    expect(samples.filter((elapsed) => elapsed < 200).length).toBeGreaterThanOrEqual(19);
  });
});
