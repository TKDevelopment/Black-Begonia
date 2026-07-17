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
});
