import { FloralProposalRenderPayload } from './floral-proposal-builder.service';
import {
  FloralProposalWorkflowService,
  validateEditableProposalSnapshotV3,
} from './floral-proposal-workflow.service';

describe('FloralProposalWorkflowService V3 snapshot projection', () => {
  const followingPayload: FloralProposalRenderPayload = {
    tax_region_id: 'tax-1',
    tax_region_name: 'Rhode Island',
    tax_rate: 0.07,
    default_markup_percent: 300,
    line_items: [
      {
        display_order: 0,
        line_item_type: 'product',
        line_type_label: 'Product',
        item_name: 'Bridal bouquet',
        quantity: 2,
        calculated_unit_price: 100,
        actual_unit_price_override: null,
        unit_price: 100,
        subtotal: 200,
        components: [],
      },
      {
        display_order: 1,
        line_item_type: 'labor',
        line_type_label: 'Labor',
        item_name: 'Installation labor',
        quantity: 1,
        unit_price: 50,
        subtotal: 50,
        components: [],
      },
    ],
    shopping_list: [],
    totals: { subtotal: 250, taxAmount: 17.5, totalAmount: 267.5 },
    breakdown: {
      productsTotal: 200,
      laborTotal: 50,
      manualLaborTotal: 50,
      feesTotal: 0,
      discountsTotal: 0,
      subtotal: 250,
      taxAmount: 17.5,
      totalAmount: 267.5,
    },
  };

  function createService(): FloralProposalWorkflowService {
    return new FloralProposalWorkflowService({} as never, {} as never);
  }

  it('projects following product pricing and explicit manual labor into a valid V3 snapshot', () => {
    const snapshot = createService().buildProposalSnapshot({
      renderPayload: followingPayload,
      existingSnapshot: {
        labor_percent: 20,
        legacy_labor_percent: 20,
        retained_note: 'Keep me',
      },
    });

    expect(snapshot['schema_version']).toBe(3);
    expect(snapshot['labor_percent']).toBeUndefined();
    expect(snapshot['legacy_labor_percent']).toBeUndefined();
    expect(snapshot['retained_note']).toBe('Keep me');
    expect(snapshot['line_items']).toEqual([
      jasmine.objectContaining({
        line_item_type: 'product',
        calculated_unit_price: 100,
        actual_unit_price_override: null,
        unit_price: 100,
        subtotal: 200,
      }),
      jasmine.objectContaining({
        line_item_type: 'labor',
        unit_price: 50,
        subtotal: 50,
      }),
    ]);
    expect(validateEditableProposalSnapshotV3(snapshot)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('accepts a zero override as an explicit effective product price', () => {
    const snapshot = createService().buildProposalSnapshot({
      renderPayload: {
        ...followingPayload,
        line_items: [
          {
            ...followingPayload.line_items[0],
            actual_unit_price_override: 0,
            unit_price: 0,
            subtotal: 0,
          },
        ],
        totals: { subtotal: 0, taxAmount: 0, totalAmount: 0 },
        breakdown: {
          productsTotal: 0,
          laborTotal: 0,
          manualLaborTotal: 0,
          feesTotal: 0,
          discountsTotal: 0,
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
        },
      },
    });

    expect(validateEditableProposalSnapshotV3(snapshot).valid).toBeTrue();
    expect((snapshot['line_items'] as Record<string, unknown>[])[0]).toEqual(
      jasmine.objectContaining({
        calculated_unit_price: 100,
        actual_unit_price_override: 0,
        unit_price: 0,
      })
    );
  });

  it('rejects inconsistent effective pricing, totals, and retired percentage labor', () => {
    const invalid = {
      schema_version: 3,
      labor_percent: 10,
      line_items: [
        {
          line_item_type: 'product',
          quantity: 2,
          calculated_unit_price: 100,
          actual_unit_price_override: 125,
          unit_price: 100,
          subtotal: 200,
        },
      ],
      totals: { subtotal: 200, taxAmount: 10, totalAmount: 215 },
      breakdown: { calculatedLaborAmount: 20 },
    };

    const result = validateEditableProposalSnapshotV3(invalid);

    expect(result.valid).toBeFalse();
    expect(result.errors).toContain('Active labor_percent is not allowed in V3.');
    expect(result.errors).toContain('Calculated percentage labor is not allowed in V3.');
    expect(result.errors).toContain('Line 1 effective unit price is inconsistent.');
    expect(result.errors).toContain('Snapshot total amount is inconsistent.');
  });

  it('blocks malformed active snapshots before a save or submission boundary is reached', () => {
    expect(() =>
      createService().buildProposalSnapshot({
        renderPayload: {
          ...followingPayload,
          line_items: [
            {
              ...followingPayload.line_items[0],
              actual_unit_price_override: 125,
              unit_price: 100,
            },
          ],
          totals: { subtotal: 200, taxAmount: 14, totalAmount: 214 },
          breakdown: {
            productsTotal: 200,
            laborTotal: 0,
            manualLaborTotal: 0,
            feesTotal: 0,
            discountsTotal: 0,
            subtotal: 200,
            taxAmount: 14,
            totalAmount: 214,
          },
        },
      })
    ).toThrowError(/proposal pricing snapshot is inconsistent/i);
  });
});
