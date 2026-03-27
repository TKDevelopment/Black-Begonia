import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { ProposalAccessService } from '../proposal-access/proposal-access.service';

export const proposalAccessGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const proposalAccessService = inject(ProposalAccessService);

  if (proposalAccessService.hasValidSession()) {
    return true;
  }

  return router.createUrlTree(['/proposal/auth']);
};


