import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import {
  AuthServiceGuardTestDouble,
  createAuthServiceGuardTestDouble,
} from '../testing/auth-testing';
import { createRouterMock } from '../testing/router-testing';
import { workshopRetentionPolicyAdminGuard } from './workshop-retention-policy-admin.guard';

describe('workshopRetentionPolicyAdminGuard', () => {
  let auth: AuthServiceGuardTestDouble;
  let router: ReturnType<typeof createRouterMock>;
  let deniedTree: UrlTree;

  function configure(
    roles: Array<'admin' | 'staff'>,
    internal = true,
  ): void {
    auth = createAuthServiceGuardTestDouble({ isInternalUser: internal });
    Object.defineProperty(auth, 'snapshot', {
      configurable: true,
      get: () => ({ roles }),
    });
    deniedTree = { toString: () => '/admin/workshops' } as UrlTree;
    router = createRouterMock();
    router.createUrlTree.and.returnValue(deniedTree);
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  }

  const execute = () => TestBed.runInInjectionContext(
    () => workshopRetentionPolicyAdminGuard({} as never, {} as never) as
      Promise<boolean | UrlTree>,
  );

  afterEach(() => TestBed.resetTestingModule());

  it('allows an active existing admin', async () => {
    configure(['admin']);
    await expectAsync(execute()).toBeResolvedTo(true);
  });

  it('denies an active staff user', async () => {
    configure(['staff']);
    await expectAsync(execute()).toBeResolvedTo(deniedTree);
  });

  it('denies an inactive admin', async () => {
    configure(['admin'], false);
    await expectAsync(execute()).toBeResolvedTo(deniedTree);
  });
});
