import { TestBed } from '@angular/core/testing';

import { ProposalTemplateSceneRendererService } from '../../proposal-templates/proposal-template-scene-renderer.service';
import { testRenderContract } from '../../testing/workflow-fixtures';
import { FloralProposalRendererService } from './floral-proposal-renderer.service';

describe('FloralProposalRendererService', () => {
  let service: FloralProposalRendererService;
  let sceneRenderer: jasmine.SpyObj<ProposalTemplateSceneRendererService>;

  beforeEach(() => {
    sceneRenderer = jasmine.createSpyObj<ProposalTemplateSceneRendererService>(
      'ProposalTemplateSceneRendererService',
      ['render']
    );

    TestBed.configureTestingModule({
      providers: [
        FloralProposalRendererService,
        {
          provide: ProposalTemplateSceneRendererService,
          useValue: sceneRenderer,
        },
      ],
    });

    service = TestBed.inject(FloralProposalRendererService);
  });

  it('delegates proposal HTML rendering to the template scene renderer', () => {
    sceneRenderer.render.and.returnValue('<html>Rendered proposal</html>');

    const html = service.renderHtml(testRenderContract);

    expect(sceneRenderer.render).toHaveBeenCalledOnceWith(testRenderContract);
    expect(html).toBe('<html>Rendered proposal</html>');
  });

  it('lets renderer errors surface to callers', () => {
    const error = new Error('Renderer failed.');
    sceneRenderer.render.and.throwError(error);

    expect(() => service.renderHtml(testRenderContract)).toThrowError(
      'Renderer failed.'
    );
  });

  it('passes effective customer pricing and explicit manual labor without private price state', () => {
    sceneRenderer.render.and.returnValue('<html>Customer-safe proposal</html>');
    const contract = {
      ...testRenderContract,
      line_items: [
        {
          ...testRenderContract.line_items[0],
          unit_price: 125,
          subtotal: 250,
        },
        {
          ...testRenderContract.line_items[0],
          display_order: 1,
          line_item_type: 'labor' as const,
          line_type_label: 'Labor',
          item_name: 'Installation labor',
          quantity: 1,
          unit_price: 50,
          subtotal: 50,
          components: [],
        },
      ],
    };

    service.renderHtml(contract);

    const renderedContract = sceneRenderer.render.calls.mostRecent().args[0];
    expect(renderedContract.line_items[0]).toEqual(
      jasmine.objectContaining({ unit_price: 125, subtotal: 250 })
    );
    expect(renderedContract.line_items[0]).not.toEqual(
      jasmine.objectContaining({ calculated_unit_price: jasmine.anything() })
    );
    expect(renderedContract.line_items[1]).toEqual(
      jasmine.objectContaining({
        line_item_type: 'labor',
        item_name: 'Installation labor',
        unit_price: 50,
      })
    );
  });
});
