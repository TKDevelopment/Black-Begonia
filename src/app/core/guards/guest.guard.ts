import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const guestGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isReady) {
    await authService.init();
  }

  if (authService.isAuthenticated && authService.isInternalUser) {
    return router.createUrlTree(['/admin/dashboard']);
  }

  return true;
};