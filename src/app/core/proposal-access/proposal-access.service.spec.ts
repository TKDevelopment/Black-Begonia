import { TestBed } from '@angular/core/testing';

import { SupabaseService } from '../supabase/clients/supabase.service';
import { testProposalAccessSession } from '../testing/workflow-fixtures';
import { ProposalAccessSession } from './proposal-access.models';
import { ProposalAccessService } from './proposal-access.service';

describe('ProposalAccessService', () => {
  let service: ProposalAccessService;
  let invokeSpy: jasmine.Spy;
  let consoleErrorSpy: jasmine.Spy;

  const storageKey = 'bb.floral-proposal-access-session';

  beforeEach(() => {
    window.sessionStorage.clear();
    invokeSpy = jasmine.createSpy('invoke');

    TestBed.configureTestingModule({
      providers: [
        ProposalAccessService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              functions: {
                invoke: invokeSpy,
              },
            }),
          },
        },
      ],
    });

    service = TestBed.inject(ProposalAccessService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('hydrates valid sessions from session storage', () => {
    const futureSession = buildSession({
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    window.sessionStorage.setItem(storageKey, JSON.stringify(futureSession));

    const hydrated = TestBed.runInInjectionContext(
      () => new ProposalAccessService(TestBed.inject(SupabaseService))
    );

    expect(hydrated.hasValidSession()).toBeTrue();
    expect(hydrated.getSession()).toEqual(futureSession);
  });

  it('clears expired or malformed sessions during validation and hydration', () => {
    const expiredSession = buildSession({
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    service.session.set(expiredSession);

    expect(service.hasValidSession()).toBeFalse();
    expect(service.session()).toBeNull();

    window.sessionStorage.setItem(storageKey, '{bad-json');
    const hydrated = TestBed.runInInjectionContext(
      () => new ProposalAccessService(TestBed.inject(SupabaseService))
    );

    expect(hydrated.session()).toBeNull();
    expect(window.sessionStorage.getItem(storageKey)).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProposalAccessService] hydrateSession error:',
      jasmine.any(SyntaxError)
    );
  });

  it('verifies proposal access with normalized credentials and persists the returned session', async () => {
    const session = buildSession({
      file_name: 'canva-proposal.pdf',
      authenticated_at: '2026-06-02T12:00:00.000Z',
    });
    invokeSpy.and.resolveTo({
      data: { success: true, session },
      error: null,
    });

    const result = await service.verifyAccess(' AVERY@EXAMPLE.TEST ', '  123456 ');

    expect(invokeSpy).toHaveBeenCalledWith('verify-floral-proposal-access', {
      body: {
        email: 'avery@example.test',
        passcode: '123456',
      },
    });
    expect(result).toEqual(session);
    expect(service.getSession()).toEqual(session);
    expect(JSON.parse(window.sessionStorage.getItem(storageKey) ?? '{}')).toEqual(
      session
    );
    expect(service.getSession()?.file_name).toBe('canva-proposal.pdf');
  });

  it('prefers combined review assets and refreshes embedded signing sessions', async () => {
    const session = buildSession({
      file_name: 'canva-proposal.pdf',
      combined_file_name: 'proposal-package.pdf',
      pdf_url: 'https://example.test/proposal.pdf',
      combined_pdf_url: 'https://example.test/proposal-package.pdf',
      embedded_signing_url: null,
    });
    service.session.set(session);
    invokeSpy.and.resolveTo({
      data: {
        success: true,
        session: {
          ...session,
          embedded_signing_url: 'https://signwell.example.test/session/abc123',
        },
      },
      error: null,
    });

    expect(service.getReviewDocumentUrl()).toBe('https://example.test/proposal-package.pdf');
    expect(service.getReviewFileName()).toBe('proposal-package.pdf');
    expect(service.hasEmbeddedSigning()).toBeFalse();

    const refreshed = await service.refreshSigningSession();
    expect(invokeSpy).toHaveBeenCalledWith('verify-floral-proposal-access', {
      body: {
        floral_proposal_id: session.floral_proposal_id,
        access_token: session.access_token,
      },
    });
    expect(refreshed.embedded_signing_url).toBe(
      'https://signwell.example.test/session/abc123'
    );
    expect(service.hasEmbeddedSigning()).toBeTrue();
    expect(service.getEmbeddedSigningUrl()).toBe(
      'https://signwell.example.test/session/abc123'
    );
  });

  it('throws friendly verification errors for edge-function failures and invalid credentials', async () => {
    invokeSpy.and.resolveTo({
      data: null,
      error: new Error('function unavailable'),
    });

    await expectAsync(
      service.verifyAccess('avery@example.test', '123456')
    ).toBeRejectedWithError(
      'We could not verify your Floral Proposal access right now.'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProposalAccessService] verifyAccess invoke error:',
      jasmine.any(Error)
    );

    invokeSpy.and.resolveTo({
      data: { success: false, error: 'Invalid passcode.' },
      error: null,
    });
    await expectAsync(
      service.verifyAccess('avery@example.test', 'bad')
    ).toBeRejectedWithError('Invalid passcode.');
  });

  it('submits accepted responses with terms, privacy, and signature payloads', async () => {
    const session = buildSession();
    service.session.set(session);
    invokeSpy.and.resolveTo({
      data: {
        success: true,
        lead_status: 'proposal_accepted',
        action: 'accept',
      },
      error: null,
    });

    const response = await service.submitResponse({
      action: 'accept',
      feedback: '  Looks perfect.  ',
      accepted_terms: true,
      accepted_privacy_policy: true,
      signature_name: '  Avery Bloom  ',
    });

    expect(invokeSpy).toHaveBeenCalledWith('submit-floral-proposal-response', {
      body: {
        floral_proposal_id: session.floral_proposal_id,
        access_token: session.access_token,
        action: 'accept',
        feedback: 'Looks perfect.',
        accepted_terms: true,
        accepted_privacy_policy: true,
        signature_name: 'Avery Bloom',
      },
    });
    expect(response).toEqual({
      success: true,
      lead_status: 'proposal_accepted',
      action: 'accept',
    });
    expect(service.session()?.response_action).toBe('accept');
    expect(service.session()?.response_feedback).toBeNull();
    expect(service.session()?.signing_status).toBe('signed');
    expect(service.session()?.responded_at).toEqual(jasmine.any(String));
  });

  it('submits declined responses with trimmed feedback stored on the session', async () => {
    service.session.set(buildSession());
    invokeSpy.and.resolveTo({
      data: {
        success: true,
        lead_status: 'proposal_declined',
        action: 'decline',
      },
      error: null,
    });

    await service.submitResponse({
      action: 'decline',
      feedback: '  We need to reduce the scope.  ',
    });

    expect(service.session()?.response_action).toBe('decline');
    expect(service.session()?.signing_status).toBe('declined');
    expect(service.session()?.response_feedback).toBe(
      'We need to reduce the scope.'
    );
  });

  it('rejects response submission without a valid session or after a previous response', async () => {
    await expectAsync(
      service.submitResponse({ action: 'accept' })
    ).toBeRejectedWithError('Your Floral Proposal access session has expired.');

    service.session.set(buildSession({ response_action: 'accept' }));
    await expectAsync(
      service.submitResponse({ action: 'decline' })
    ).toBeRejectedWithError(
      'This Floral Proposal has already received a response and can no longer be updated.'
    );
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it('rejects refresh attempts without a valid session', async () => {
    await expectAsync(service.refreshSession()).toBeRejectedWithError(
      'Your Floral Proposal access session has expired.'
    );
  });

  it('throws friendly response errors for edge-function failures and failed responses', async () => {
    service.session.set(buildSession());
    invokeSpy.and.resolveTo({
      data: null,
      error: new Error('function unavailable'),
    });

    await expectAsync(
      service.submitResponse({ action: 'accept' })
    ).toBeRejectedWithError(
      'We could not submit your Floral Proposal response right now.'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProposalAccessService] submitResponse invoke error:',
      jasmine.any(Error)
    );

    invokeSpy.and.resolveTo({
      data: { success: false, error: 'Response window closed.' },
      error: null,
    });
    await expectAsync(
      service.submitResponse({ action: 'accept' })
    ).toBeRejectedWithError('Response window closed.');
  });

  it('reports response state and clears persisted sessions', () => {
    const session = buildSession({ response_action: 'decline' });
    service.session.set(session);
    window.sessionStorage.setItem(storageKey, JSON.stringify(session));

    expect(service.hasResponded()).toBeTrue();

    service.clearSession();

    expect(service.session()).toBeNull();
    expect(service.hasResponded()).toBeFalse();
    expect(window.sessionStorage.getItem(storageKey)).toBeNull();
  });

  function buildSession(
    overrides: Partial<ProposalAccessSession> = {}
  ): ProposalAccessSession {
    return {
      ...testProposalAccessSession,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      response_action: null,
      response_feedback: null,
      responded_at: null,
      ...overrides,
    };
  }
});
