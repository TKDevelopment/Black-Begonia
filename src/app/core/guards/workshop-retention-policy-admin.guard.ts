import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '../auth/auth.service';

async function resolveRetentionPolicyAdminGuard(): Promise<boolean | UrlTree> {
  const platformId = inject(PLATFORM_ID);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) return true;
  if (!auth.isReady) await auth.init();
  if (!auth.isAuthenticated) return router.createUrlTree(['/login']);
  if (auth.isInternalUser && auth.snapshot.roles.includes('admin')) return true;
  return router.createUrlTree(['/admin/workshops']);
}

export const workshopRetentionPolicyAdminGuard: CanActivateFn =
  async () => resolveRetentionPolicyAdminGuard();
