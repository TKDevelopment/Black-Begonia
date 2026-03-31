import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateChildFn, CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';

async function resolveAdminRoleGuard(): Promise<boolean | UrlTree> {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  if (!authService.isReady) {
    await authService.init();
  }

  if (!authService.isAuthenticated) {
    return router.createUrlTree(['/login']);
  }

  if (authService.isInternalUser) {
    return true;
  }

  return router.createUrlTree(['/login']);
}

export const adminRoleGuard: CanActivateFn = async () => resolveAdminRoleGuard();

export const adminRoleChildGuard: CanActivateChildFn = async () => resolveAdminRoleGuard();
