import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { ProposalAccessService } from '../proposal-access/proposal-access.service';

export const proposalAccessGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const proposalAccessService = inject(ProposalAccessService);

  const session = proposalAccessService.getSession();
  const hasReviewContent =
    !!proposalAccessService.getReviewDocumentUrl() ||
    !!proposalAccessService.getEmbeddedSigningUrl() ||
    !!session?.response_action;

  if (session && hasReviewContent) {
    return true;
  }

  if (session && !hasReviewContent) {
    proposalAccessService.clearSession();
  }

  return router.createUrlTree(['/proposal/auth']);
};


