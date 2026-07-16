import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ProposalAccessSession } from '../../../core/proposal-access/proposal-access.models';
import { ProposalAccessService } from '../../../core/proposal-access/proposal-access.service';
import { testProposalAccessSession } from '../../../core/testing/workflow-fixtures';
import { ProposalReviewComponent } from './proposal-review.component';

describe('ProposalReviewComponent', () => {
  let component: ProposalReviewComponent;
  let fixture: ComponentFixture<ProposalReviewComponent>;
  let proposalAccess: jasmine.SpyObj<ProposalAccessService>;
  let router: jasmine.SpyObj<Router>;
  let consoleErrorSpy: jasmine.Spy;
  let currentSession: ProposalAccessSession | null;

  beforeEach(async () => {
    currentSession = buildSession();

    proposalAccess = jasmine.createSpyObj<ProposalAccessService>(
      'ProposalAccessService',
      [
        'hasValidSession',
        'getSession',
        'getReviewDocumentUrl',
        'getReviewFileName',
        'getEmbeddedSigningUrl',
        'submitResponse',
        'refreshSigningSession',
        'clearSession',
      ]
    );
    proposalAccess.hasValidSession.and.callFake(() => !!currentSession);
    proposalAccess.getSession.and.callFake(() => currentSession);
    proposalAccess.getReviewDocumentUrl.and.callFake(
      () => currentSession?.combined_pdf_url ?? currentSession?.pdf_url ?? null
    );
    proposalAccess.getReviewFileName.and.callFake(
      () => currentSession?.combined_file_name ?? currentSession?.file_name ?? null
    );
    proposalAccess.getEmbeddedSigningUrl.and.callFake(
      () => currentSession?.embedded_signing_url ?? null
    );
    proposalAccess.submitResponse.and.resolveTo({
      success: true,
      lead_status: 'proposal_declined',
      action: 'decline',
    });
    proposalAccess.refreshSigningSession.and.callFake(async () => {
      if (!currentSession) {
        throw new Error('Your Floral Proposal access session has expired.');
      }

      currentSession = {
        ...currentSession,
        embedded_signing_url: 'https://signwell.example.test/session/refreshed',
      };

      return currentSession;
    });

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [ProposalReviewComponent],
      providers: [
        { provide: ProposalAccessService, useValue: proposalAccess },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
  });

  it('redirects to auth and renders missing-session state without valid access', () => {
    currentSession = null;
    proposalAccess.hasValidSession.and.returnValue(false);

    createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/proposal/auth']);
    expect(text()).toContain('Access Required');
    expect(text()).toContain('Your Floral Proposal session is unavailable.');
  });

  it('renders the combined review package and embedded signing details for a signwell session', () => {
    currentSession = buildSession({
      file_name: 'canva-proposal.pdf',
      combined_file_name: 'proposal-package.pdf',
      combined_pdf_url: 'https://example.test/proposal-package.pdf',
      signing_provider: 'signwell',
      signing_status: 'ready_for_signing',
      embedded_signing_url: 'https://signwell.example.test/session/abc123',
    });

    createComponent();

    expect(text()).toContain('Active Floral Proposal');
    expect(text()).toContain('proposal-package.pdf');
    expect(text()).toContain('Signwell');
    expect(text()).toContain('Ready For Signing');
    expect(text()).toContain('Jump To Signing');
    expect(link('a')?.href).toBe('https://example.test/proposal-package.pdf');
    expect(iframes().length).toBe(2);
    expect(iframes()[0].getAttribute('title')).toBe('Floral Proposal PDF viewer');
    expect(iframes()[1].getAttribute('title')).toBe('Embedded proposal signing');
  });

  it('shows missing-preview messaging when the session has no review document url', () => {
    currentSession = buildSession({
      pdf_url: null,
      combined_pdf_url: null,
      embedded_signing_url: null,
    });

    createComponent();

    expect(text()).toContain('This secure Floral Proposal link is no longer available.');
    expect(iframes().length).toBe(0);
  });

  it('hydrates an already accepted proposal response and blocks new response modals', () => {
    currentSession = buildSession({
      response_action: 'accept',
      responded_at: '2026-06-02T12:30:00.000Z',
    });

    createComponent();
    component.openAcceptModal();
    component.openDeclineModal();
    fixture.detectChanges();

    expect(component.completedAction()).toBe('accept');
    expect(component.successMessage()).toBe(
      'This Floral Proposal has already been accepted.'
    );
    expect(component.acceptModalOpen()).toBeFalse();
    expect(component.declineModalOpen()).toBeFalse();
    expect(text()).toContain('Floral Proposal already accepted');
  });

  it('redirects accept actions into the embedded signing panel for signwell proposals', async () => {
    const scrollIntoView = jasmine.createSpy('scrollIntoView');
    currentSession = buildSession({
      signing_provider: 'signwell',
      signing_status: 'ready',
      embedded_signing_url: 'https://signwell.example.test/session/abc123',
    });
    spyOn(document, 'getElementById').and.returnValue({
      scrollIntoView,
    } as unknown as HTMLElement);

    createComponent();
    component.openAcceptModal();
    await component.confirmAccept();
    fixture.detectChanges();

    expect(component.acceptModalOpen()).toBeFalse();
    expect(component.errorMessage()).toBe(
      'Please complete the embedded signing steps below to accept this Floral Proposal.'
    );
    expect(proposalAccess.submitResponse).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('refreshes embedded signing sessions and focuses the signer when it becomes available', async () => {
    const scrollIntoView = jasmine.createSpy('scrollIntoView');
    currentSession = buildSession({
      signing_provider: 'signwell',
      signing_status: 'ready',
      embedded_signing_url: null,
    });
    spyOn(document, 'getElementById').and.returnValue({
      scrollIntoView,
    } as unknown as HTMLElement);

    createComponent();
    await component.refreshSigningSession();
    fixture.detectChanges();

    expect(proposalAccess.refreshSigningSession).toHaveBeenCalled();
    expect(component.refreshingSigning()).toBeFalse();
    expect(component.hasEmbeddedSigning()).toBeTrue();
    expect(scrollIntoView).toHaveBeenCalled();
    expect(text()).toContain('Embedded Signing');
  });

  it('submits declined responses with trimmed feedback and preserves exit behavior', async () => {
    createComponent();
    component.openDeclineModal();
    component.declineFeedback.set('  Please revise the bouquet palette.  ');

    await component.confirmDecline();
    await component.signOut();
    fixture.detectChanges();

    expect(proposalAccess.submitResponse).toHaveBeenCalledWith({
      action: 'decline',
      feedback: 'Please revise the bouquet palette.',
    });
    expect(component.completedAction()).toBe('decline');
    expect(component.declineModalState()).toBe('success');
    expect(component.successMessage()).toBe(
      'Your message was received and the Floral Proposal was declined successfully.'
    );
    expect(proposalAccess.clearSession).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/proposal/auth']);
  });

  it('shows fallback refresh errors and formats empty date values', async () => {
    proposalAccess.refreshSigningSession.and.rejectWith('offline');

    createComponent();
    await component.refreshSigningSession();
    fixture.detectChanges();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProposalReviewComponent] refreshSigningSession error:',
      'offline'
    );
    expect(component.errorMessage()).toBe(
      'We could not refresh your signing session right now.'
    );
    expect(component.formatDate(null)).toBe('Not provided');
    expect(component.formatDate('2026-11-28')).toBe('November 28, 2026');
    expect(component.formatDateTime(undefined)).toBe('Not provided');
    expect(component.formatSigningStatus(null)).toBe('Not started');
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ProposalReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function buildSession(
    overrides: Partial<ProposalAccessSession> = {}
  ): ProposalAccessSession {
    return {
      ...testProposalAccessSession,
      client_name: 'Avery Bloom',
      customer_email: 'avery@example.test',
      event_date: '2026-06-20T12:00:00.000Z',
      event_type: 'wedding',
      service_type: 'full service',
      version: 3,
      file_name: 'canva-proposal.pdf',
      pdf_url: 'https://example.test/proposal.pdf',
      combined_file_name: 'proposal-package.pdf',
      combined_pdf_url: 'https://example.test/proposal-package.pdf',
      response_action: null,
      response_feedback: null,
      responded_at: null,
      signing_provider: null,
      signing_status: null,
      embedded_signing_url: null,
      ...overrides,
    };
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }

  function link(selector: string): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  function iframes(): HTMLIFrameElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('iframe'));
  }
});
