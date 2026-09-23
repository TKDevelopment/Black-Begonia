import { FloralProposalRenderContract } from '../models/floral-proposal';
import { testRenderContract } from '../testing/workflow-fixtures';
import { ProposalTemplateDocumentService } from './proposal-template-document.service';
import { ProposalTemplateSceneRendererService } from './proposal-template-scene-renderer.service';

describe('ProposalTemplateSceneRendererService pricing privacy', () => {
  it('renders only effective unit prices and keeps explicit manual labor customer-visible', () => {
    const service = new ProposalTemplateSceneRendererService(
      new ProposalTemplateDocumentService()
    );
    const contract = {
      ...testRenderContract,
      pricing: {
        ...testRenderContract.pricing,
        labor_percent: 25,
      },
      line_items: [
        {
          ...testRenderContract.line_items[0],
          item_name: 'Effective-price bouquet',
          quantity: 1,
          calculated_unit_price: 111,
          actual_unit_price_override: 222,
          unit_price: 222,
          subtotal: 222,
          legacy_labor_conversion: { key: 'labor-percent-v1' },
        },
        {
          ...testRenderContract.line_items[0],
          display_order: 1,
          line_item_type: 'labor',
          line_type_label: 'Labor',
          item_name: 'On-site installation labor',
          quantity: 1,
          unit_price: 50,
          subtotal: 50,
          components: [],
        },
      ],
      totals: {
        products_total: 222,
        labor_total: 50,
        fees_total: 0,
        discounts_total: 0,
        subtotal: 272,
        tax_amount: 0,
        total_amount: 272,
        calculatedLaborAmount: 999,
      },
    } as unknown as FloralProposalRenderContract;

    const html = service.render(contract);

    expect(html).toContain('Effective-price bouquet');
    expect(html).toContain('$222.00');
    expect(html).toContain('On-site installation labor');
    expect(html).toContain('$50.00');
    expect(html).not.toContain('$111.00');
    expect(html).not.toContain('$999.00');
    expect(html).not.toContain('labor-percent-v1');
  });

  it('retains recorded effective values when rendering a compatibility-shaped immutable proposal', () => {
    const service = new ProposalTemplateSceneRendererService(
      new ProposalTemplateDocumentService()
    );
    const contract: FloralProposalRenderContract = {
      ...testRenderContract,
      line_items: [
        {
          ...testRenderContract.line_items[0],
          item_name: 'Recorded legacy arrangement',
          quantity: 2,
          unit_price: 87.5,
          subtotal: 175,
          components: [],
        },
      ],
      totals: {
        products_total: 175,
        labor_total: 0,
        fees_total: 0,
        discounts_total: 0,
        subtotal: 175,
        tax_amount: 0,
        total_amount: 175,
      },
    };

    const html = service.render(contract);

    expect(html).toContain('Recorded legacy arrangement');
    expect(html).toContain('$87.50');
    expect(html).toContain('$175.00');
  });
});
