import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';

async function resolveAuthGuard(): Promise<boolean | UrlTree> {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isReady) {
    await authService.init();
  }

  if (authService.isAuthenticated) {
    return true;
  }

  return router.createUrlTree(['/login']);
}

export const authGuard: CanActivateFn = async () => resolveAuthGuard();

export const authChildGuard: CanActivateChildFn = async () => resolveAuthGuard();