import { Injectable } from '@angular/core';

import { FloralProposalRenderContract } from '../../models/floral-proposal';
import { ProposalTemplateSceneRendererService } from '../../proposal-templates/proposal-template-scene-renderer.service';

@Injectable({
  providedIn: 'root',
})
export class FloralProposalRendererService {
  constructor(
    private readonly proposalTemplateSceneRenderer: ProposalTemplateSceneRendererService
  ) {}

  renderHtml(contract: FloralProposalRenderContract): string {
    return this.proposalTemplateSceneRenderer.render(contract);
  }
}
