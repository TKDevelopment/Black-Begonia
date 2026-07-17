import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { ProposalAccessService } from '../proposal-access/proposal-access.service';
import { proposalAccessGuard } from './proposal-access.guard';

describe('proposalAccessGuard', () => {
  let proposalAccessService: jasmine.SpyObj<ProposalAccessService>;
  let router: jasmine.SpyObj<Router>;
  let authTree: UrlTree;

  beforeEach(() => {
    authTree = { toString: () => '/proposal/auth' } as UrlTree;
    proposalAccessService = jasmine.createSpyObj<ProposalAccessService>(
      'ProposalAccessService',
      ['getSession', 'getReviewDocumentUrl', 'getEmbeddedSigningUrl', 'clearSession']
    );
    router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue(authTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: ProposalAccessService, useValue: proposalAccessService },
        { provide: Router, useValue: router },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  const executeGuard = () => TestBed.runInInjectionContext(
    () => proposalAccessGuard({} as never, {} as never)
  );

  it('allows proposal review when a valid proposal access session exists', () => {
    proposalAccessService.getSession.and.returnValue({ response_action: null } as never);
    proposalAccessService.getReviewDocumentUrl.and.returnValue('https://example.test/proposal.pdf');

    expect(executeGuard()).toBeTrue();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to proposal authentication when no valid session exists', () => {
    proposalAccessService.getSession.and.returnValue(null);
    proposalAccessService.getReviewDocumentUrl.and.returnValue(null);
    proposalAccessService.getEmbeddedSigningUrl.and.returnValue(null);

    expect(executeGuard()).toBe(authTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/proposal/auth']);
  });
});
