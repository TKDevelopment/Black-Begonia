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
    expect(result.reserve_units).toBe(12);
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

  it('calculates totals with manual labor, fees, discounts, and tax without percentage labor', () => {
    const lines: FloralProposalBuilderLine[] = [
      { ...service.createEmptyLine(0), line_item_type: 'product', subtotal: 100 },
      { ...service.createFeeLine(1, 'Setup Labor', 1, 20), line_item_type: 'labor' },
      service.createFeeLine(2, 'Delivery', 1, 10),
      service.createDiscountLine(3, 'Courtesy Credit', 1, 5),
    ];

    const totals = service.calculateTotals(lines, taxRegion);

    expect(totals.subtotal).toBe(125);
    expect(totals.taxAmount).toBe(10);
    expect(totals.totalAmount).toBe(135);
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
      subtotal: 92.2,
      taxAmount: 7.38,
      totalAmount: 99.58,
    });
    expect(payload.breakdown).toEqual(
      jasmine.objectContaining({
        productsTotal: 67.2,
        laborTotal: 0,
        manualLaborTotal: 0,
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
          reserve_units: 10,
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
      calculated_unit_price: 72,
      actual_unit_price_override: null,
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
          quantity_per_unit: 30,
          extended_quantity: 60,
          base_unit_cost: 3,
          purchase_unit_cost: 30,
          applied_markup_percent: 20,
          reserve_units: 20,
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
          quantity_per_unit: 40,
          extended_quantity: 40,
          base_unit_cost: 3,
          purchase_unit_cost: 30,
          applied_markup_percent: 20,
          reserve_units: 0,
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
        required_units: 100,
        reserve_percent: 0,
        requested_reserve_units: 20,
        total_plus_reserve: 120,
        reserve_units: 20,
        total_units_to_buy: 120,
        units_per_pack: 10,
        required_pack_count: 12,
        pricing_unit_cost: 3,
        estimated_pack_cost: 30,
        total_estimated_cost: 360,
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
      reserve_percent: 0,
      reserve_units: 1,
      snapshot: {
        reserve_units: 1,
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
      default_markup_percent: 275, labor_percent: 0,
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
      catalog_item_id: 'retired-rose', base_unit_cost: 3.25, sell_unit_price: 12.19,
      subtotal: 243.8, reserve_units: 2,
    }));
  });

  it('rejects snapshots missing editable core data', () => {
    const financials = { subtotal: 0, taxRate: 0, taxAmount: 0, totalAmount: 0, retainerAmount: 0, finalBalanceAmount: 0 };
    expect(service.adaptProjectSnapshot({}, financials).valid).toBeFalse();
    expect(service.adaptProjectSnapshot({ line_items: [{ item_name: '' }] }, financials).valid).toBeFalse();
  });

  it('upgrades supported v2 editable values to v3 without active percentage labor', () => {
    const adapted = service.adaptProjectSnapshot({
      schema_version: 2,
      tax_region: { tax_region_id: 'tax-1', name: 'County', tax_rate: .06, was_active: false },
      default_markup_percent: 300, labor_percent: 0,
      line_items: [{ local_id: 'line-1', display_order: 0, line_item_type: 'fee', item_name: 'Delivery', description: 'Recorded', quantity: 1, unit_price: 50, subtotal: 50, components: [] }],
      shopping_list: [], breakdown: { feesTotal: 50 },
    }, { subtotal: 50, taxRate: .06, taxAmount: 3, totalAmount: 53, retainerAmount: 15.9, finalBalanceAmount: 53 });
    expect(adapted.valid).toBeTrue();
    expect(adapted.warning).toContain('older snapshot format');
    expect(adapted.draft).toEqual(jasmine.objectContaining({ schema_version: 3, default_markup_percent: 300 }));
    expect(adapted.draft as unknown as Record<string, unknown>).not.toEqual(
      jasmine.objectContaining({ labor_percent: jasmine.anything() })
    );
    expect(adapted.draft?.tax_region.was_active).toBeFalse();
    expect(adapted.draft?.line_items[0].description).toBe('Recorded');
  });

  it('recovers an active proposal with an unused blank editor row without changing its quote', () => {
    const named = {
      line_item_type: 'fee', item_name: 'Delivery', quantity: 1,
      unit_price: 50, subtotal: 50, components: [],
    };
    const placeholder = {
      line_item_type: 'product', item_name: '', quantity: 1,
      unit_price: 0, calculated_unit_price: 0,
      actual_unit_price_override: null, subtotal: 0, components: [],
    };
    const source = { schema_version: 3, proposal_status: 'finalized', line_items: [named, placeholder] };
    const financials = { subtotal: 50, taxRate: 0, taxAmount: 0, totalAmount: 50, retainerAmount: 15, finalBalanceAmount: 50 };

    const adapted = service.adaptProjectSnapshot(source, financials);

    expect(adapted.valid).toBeTrue();
    expect(adapted.draft?.line_items.map((line) => line.item_name)).toEqual(['Delivery']);
    expect(adapted.draft?.totals.totalAmount).toBe(50);
    expect(source.line_items).toHaveSize(2);
    expect(adapted.warning).toContain('blank');

    const unsafe = service.adaptProjectSnapshot({
      ...source,
      line_items: [named, { ...placeholder, calculated_unit_price: 25, unit_price: 25, subtotal: 25 }],
    }, { ...financials, subtotal: 75, totalAmount: 75 });
    expect(unsafe.valid).toBeTrue();
    expect(unsafe.draft?.line_items).toHaveSize(2);
    expect(unsafe.draft?.line_items[1].subtotal).toBe(25);
    expect(unsafe.warning).toContain('name');
  });

  it('keeps one empty row in an unfinished revision draft so it can be named after reload', () => {
    const placeholder = {
      line_item_type: 'product', item_name: '', quantity: 1,
      unit_price: 0, calculated_unit_price: 0,
      actual_unit_price_override: null, subtotal: 0, components: [],
    };
    const financials = { subtotal: 0, taxRate: 0, taxAmount: 0, totalAmount: 0, retainerAmount: 0, finalBalanceAmount: 0 };
    const adapted = service.adaptProjectSnapshot({
      schema_version: 3, proposal_status: 'draft', line_items: [placeholder, placeholder],
    }, financials);
    expect(adapted.valid).toBeTrue();
    expect(adapted.draft?.line_items).toHaveSize(1);
  });

  it('omits unused blank rows from saved revisions while retaining unnamed rows with entered amounts for validation', () => {
    const named = service.createFeeLine(0, 'Delivery', 1, 50);
    const placeholder = service.createEmptyLine(1);
    const renderPayload = service.buildRenderPayload({
      lines: [named, placeholder], taxRegion: null,
      defaultMarkupPercent: 300, shoppingList: [],
    });
    const input = {
      renderPayload, retainerAmount: 15, finalBalanceAmount: 50,
      lines: [named, placeholder],
    };
    const saved = service.buildEditableProjectSnapshot(input);
    expect(saved.line_items.map((line) => line.item_name)).toEqual(['Delivery']);
    expect(saved.totals.totalAmount).toBe(50);

    const pricedWithoutName = {
      ...placeholder, unit_price: 25, calculated_unit_price: 25,
      subtotal: 25,
    };
    const unsafe = service.buildEditableProjectSnapshot({
      ...input, lines: [named, pricedWithoutName],
    });
    expect(unsafe.line_items).toHaveSize(2);

    const typedWithoutName = service.buildEditableProjectSnapshot({
      ...input, lines: [named, { ...placeholder, actual_unit_price_input: '25.00' }],
    });
    expect(typedWithoutName.line_items).toHaveSize(2);

    const unknownMetadata = service.adaptProjectSnapshot({
      schema_version: 3, proposal_status: 'draft',
      line_items: [
        { line_item_type: 'fee', item_name: 'Delivery', quantity: 1, unit_price: 50, subtotal: 50, components: [] },
        { line_item_type: 'product', item_name: '', quantity: 1, unit_price: 0, subtotal: 0,
          calculated_unit_price: 0, actual_unit_price_override: null, components: [], snapshot: { custom_note: 'Keep this' } },
      ],
    }, { subtotal: 50, taxRate: 0, taxAmount: 0, totalAmount: 50, retainerAmount: 15, finalBalanceAmount: 50 });
    expect(unknownMetadata.draft?.line_items).toHaveSize(2);
  });

  it('follows calculated product pricing, preserves explicit zero/equal overrides, and clears to reset', () => {
    const calculated = service.recalculateLine({
      ...service.createEmptyLine(0),
      item_name: 'Intentional Arrangement',
      quantity: 3,
      components: [{
        ...service.createEmptyComponentRow(0, 100),
        catalog_item_name: 'Stem',
        quantity_per_unit: 1,
        base_unit_cost: 50,
        purchase_unit_cost: 50,
      }],
    });

    expect(calculated.calculated_unit_price).toBe(100);
    expect(calculated.actual_unit_price_override).toBeNull();
    expect(calculated.unit_price).toBe(100);
    expect(calculated.subtotal).toBe(300);

    const overridden = service.applyActualUnitPriceInput(calculated, '125');
    expect(overridden.actual_unit_price_override).toBe(125);
    expect(overridden.actual_unit_price_input).toBe('125');
    expect(overridden.unit_price).toBe(125);
    expect(overridden.subtotal).toBe(375);

    const equalOverride = service.applyActualUnitPriceInput(calculated, '100');
    expect(equalOverride.actual_unit_price_override).toBe(100);

    const zeroOverride = service.applyActualUnitPriceInput(calculated, '0');
    expect(zeroOverride.actual_unit_price_override).toBe(0);
    expect(zeroOverride.actual_unit_price_input).toBe('0');
    expect(zeroOverride.unit_price).toBe(0);
    expect(zeroOverride.subtotal).toBe(0);

    const reset = service.applyActualUnitPriceInput(overridden, '');
    expect(reset.actual_unit_price_override).toBeNull();
    expect(reset.unit_price).toBe(100);
    expect(reset.subtotal).toBe(300);
  });

  it('preserves valid in-progress currency text without injecting decimals between keystrokes', () => {
    const line = service.recalculateLine(service.createEmptyLine(0));

    const firstDigit = service.applyActualUnitPriceInput(line, '2');
    const secondDigit = service.applyActualUnitPriceInput(firstDigit, '20');
    const decimalInProgress = service.applyActualUnitPriceInput(secondDigit, '20.');

    expect(firstDigit.actual_unit_price_input).toBe('2');
    expect(secondDigit.actual_unit_price_input).toBe('20');
    expect(decimalInProgress.actual_unit_price_input).toBe('20.');
    expect(decimalInProgress.unit_price).toBe(20);
  });

  it('preserves raw invalid actual price input without changing effective price', () => {
    const line = service.recalculateLine({
      ...service.createEmptyLine(0),
      quantity: 2,
      components: [{
        ...service.createEmptyComponentRow(0, 0),
        catalog_item_name: 'Stem',
        quantity_per_unit: 1,
        base_unit_cost: 10,
        purchase_unit_cost: 10,
      }],
    });

    for (const invalid of ['-1', 'abc', 'Infinity', '12.345']) {
      const result = service.applyActualUnitPriceInput(line, invalid);
      expect(result.actual_unit_price_input).toBe(invalid);
      expect(result.actual_unit_price_error).toBeTruthy();
      expect(result.unit_price).toBe(10);
      expect(result.subtotal).toBe(20);
    }
  });

  it('keeps override edits isolated from composition and shopping-list facts at representative scale', () => {
    const lines = Array.from({ length: 100 }, (_, lineIndex) =>
      service.recalculateLine({
        ...service.createEmptyLine(lineIndex),
        item_name: `Arrangement ${lineIndex + 1}`,
        components: Array.from({ length: 10 }, (_, componentIndex) => ({
          ...service.createEmptyComponentRow(componentIndex, 100),
          catalog_item_id: `item-${componentIndex}`,
          catalog_item_name: `Stem ${componentIndex + 1}`,
          quantity_per_unit: 1,
          base_unit_cost: 1,
          purchase_unit_cost: 1,
          unit_type: 'stem' as const,
        })),
      })
    );
    const compositionBefore = structuredClone(lines[0].components);
    const shoppingBefore = service.buildShoppingList(lines);
    const samples = Array.from({ length: 20 }, (_, index) => {
      const started = performance.now();
      service.applyActualUnitPriceInput(lines[index], String(75 + index));
      return performance.now() - started;
    });

    expect(lines[0].components).toEqual(compositionBefore);
    expect(service.buildShoppingList(lines)).toEqual(shoppingBefore);
    expect(samples.filter((elapsed) => elapsed < 200).length).toBeGreaterThanOrEqual(19);
  });

  it('converts nonzero legacy percentage labor exactly once and removes active percentage fields', () => {
    const legacy = {
      schema_version: 2,
      labor_percent: 20,
      line_items: [{
        local_id: 'product-1', display_order: 0, line_item_type: 'product',
        item_name: 'Arrangement', quantity: 1, unit_price: 100, subtotal: 100,
        components: [],
      }],
      breakdown: { productsTotal: 100, calculatedLaborAmount: 20, subtotal: 120 },
    };
    const financials = {
      subtotal: 120, taxRate: 0, taxAmount: 0, totalAmount: 120,
      retainerAmount: 36, finalBalanceAmount: 120,
    };

    const immutableSource = structuredClone(legacy);
    const first = service.adaptProjectSnapshot(legacy, financials);
    expect(first.valid).toBeTrue();
    expect(first.draft?.schema_version).toBe(3);
    expect(first.draft?.line_items.filter((line) => line.line_item_type === 'labor').length).toBe(1);
    expect(first.draft?.legacy_labor_conversion).toEqual(jasmine.objectContaining({
      conversion_key: 'labor-percent-v1', converted_amount: 20, status: 'converted',
    }));
    expect(first.draft as unknown as Record<string, unknown>).not.toEqual(
      jasmine.objectContaining({ labor_percent: jasmine.anything() })
    );
    expect(legacy).toEqual(immutableSource);

    const second = service.adaptProjectSnapshot(first.draft as Record<string, unknown>, financials);
    expect(second.valid).toBeTrue();
    expect(second.draft?.line_items.filter((line) => line.line_item_type === 'labor').length).toBe(1);
    expect(second.draft?.breakdown.laborTotal).toBe(20);
  });

  it('repairs marker-only and line-only partial legacy conversion state', () => {
    const product = {
      local_id: 'product-1', display_order: 0, line_item_type: 'product',
      item_name: 'Arrangement', quantity: 1, calculated_unit_price: 100,
      actual_unit_price_override: null, unit_price: 100, subtotal: 100, components: [],
    };
    const conversionLine = {
      local_id: 'labor-1', display_order: 1, line_item_type: 'labor',
      item_name: 'Labor (converted from legacy percentage)', quantity: 1,
      unit_price: 20, subtotal: 20, components: [],
      snapshot: { conversion_key: 'labor-percent-v1', origin: 'legacy_labor_percentage_conversion', source_labor_percent: 20, converted_amount: 20 },
    };
    const financials = { subtotal: 120, taxRate: 0, taxAmount: 0, totalAmount: 120, retainerAmount: 36, finalBalanceAmount: 120 };

    const markerOnly = service.adaptProjectSnapshot({
      schema_version: 3,
      line_items: [product],
      legacy_labor_conversion: { conversion_key: 'labor-percent-v1', source_labor_percent: 20, converted_amount: 20, status: 'converted' },
    }, financials);
    expect(markerOnly.valid).toBeTrue();
    expect(markerOnly.draft?.line_items.length).toBe(2);

    const lineOnly = service.adaptProjectSnapshot({
      schema_version: 3,
      line_items: [product, conversionLine],
    }, financials);
    expect(lineOnly.valid).toBeTrue();
    expect(lineOnly.draft?.legacy_labor_conversion?.converted_amount).toBe(20);
  });

  it('blocks duplicate or mismatched legacy labor conversion records', () => {
    const conversionLine = {
      local_id: 'labor-1', display_order: 0, line_item_type: 'labor',
      item_name: 'Converted labor', quantity: 1, unit_price: 20, subtotal: 20,
      components: [], snapshot: { conversion_key: 'labor-percent-v1' },
    };
    const result = service.adaptProjectSnapshot({
      schema_version: 3,
      line_items: [conversionLine],
      legacy_labor_conversion: { conversion_key: 'labor-percent-v1', source_labor_percent: 20, converted_amount: 30, status: 'converted' },
    }, { subtotal: 20, taxRate: 0, taxAmount: 0, totalAmount: 20, retainerAmount: 6, finalBalanceAmount: 20 });

    expect(result.valid).toBeFalse();
    expect(result.repairMessage).toContain('reconcile');
  });

  it('recalculates a representative 100-line proposal within the 200 ms edit budget', () => {
    const lines = Array.from({ length: 100 }, (_, index) => ({
      ...service.createEmptyLine(index), item_name: `Arrangement ${index + 1}`, quantity: 2,
      unit_price: 100, subtotal: 200,
    }));
    const samples = Array.from({ length: 20 }, () => {
      const started = performance.now();
      service.calculateTotals(lines, { tax_region_id: 'tax', name: 'Tax', tax_rate: .06, applies_to_products: true, applies_to_services: true, applies_to_delivery: true, is_active: true, created_at: '', updated_at: '' });
      return performance.now() - started;
    });
    expect(samples.filter((elapsed) => elapsed < 200).length).toBeGreaterThanOrEqual(19);
  });
});
