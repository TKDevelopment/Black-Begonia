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

  beforeEach(async () => {
    proposalAccess = jasmine.createSpyObj<ProposalAccessService>(
      'ProposalAccessService',
      ['hasValidSession', 'getSession', 'submitResponse', 'clearSession']
    );
    proposalAccess.hasValidSession.and.returnValue(true);
    proposalAccess.getSession.and.returnValue(buildSession());
    proposalAccess.submitResponse.and.resolveTo({
      success: true,
      lead_status: 'proposal_accepted',
      action: 'accept',
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
    proposalAccess.hasValidSession.and.returnValue(false);
    proposalAccess.getSession.and.returnValue(null);

    createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/proposal/auth']);
    expect(text()).toContain('Access Required');
    expect(text()).toContain('Your Floral Proposal session is unavailable.');
  });

  it('renders active proposal metadata, preview link, and pdf viewer for a valid session', () => {
    createComponent();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(text()).toContain('Active Floral Proposal');
    expect(text()).toContain('Avery Bloom');
    expect(text()).toContain('v3');
    expect(text()).toContain('June 20, 2026');
    expect(anchor('a')?.href).toBe('https://example.test/proposal.pdf');
    expect(iframe()?.getAttribute('title')).toBe('Floral Proposal PDF viewer');
  });

  it('shows missing-preview messaging when the session has no pdf url', () => {
    proposalAccess.getSession.and.returnValue(buildSession({ pdf_url: null }));

    createComponent();

    expect(text()).toContain('This secure Floral Proposal link is no longer available.');
    expect(iframe()).toBeNull();
  });

  it('hydrates an already accepted proposal response and blocks new response modals', () => {
    proposalAccess.getSession.and.returnValue(
      buildSession({
        response_action: 'accept',
        responded_at: '2026-06-02T12:30:00.000Z',
      })
    );

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

  it('requires terms, privacy acknowledgement, and signature before accepting', async () => {
    createComponent();
    component.openAcceptModal();

    await component.confirmAccept();
    fixture.detectChanges();

    expect(proposalAccess.submitResponse).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe(
      'Please accept the terms, accept the privacy policy, and provide your full signature name.'
    );
    expect(text()).toContain('Please accept the terms');
  });

  it('submits accepted responses with a trimmed signature and success state', async () => {
    createComponent();
    component.openAcceptModal();
    component.acceptedTerms.set(true);
    component.acceptedPrivacyPolicy.set(true);
    component.signatureName.set('  Avery Bloom  ');

    await component.confirmAccept();
    fixture.detectChanges();

    expect(proposalAccess.submitResponse).toHaveBeenCalledWith({
      action: 'accept',
      accepted_terms: true,
      accepted_privacy_policy: true,
      signature_name: 'Avery Bloom',
    });
    expect(component.completedAction()).toBe('accept');
    expect(component.acceptModalState()).toBe('success');
    expect(component.successMessage()).toBe(
      'Your Floral Proposal has been accepted successfully.'
    );
    expect(component.submitting()).toBeFalse();
  });

  it('resets accept state and shows errors when accept submission fails', async () => {
    proposalAccess.submitResponse.and.rejectWith(new Error('Response window closed.'));
    createComponent();
    component.openAcceptModal();
    component.acceptedTerms.set(true);
    component.acceptedPrivacyPolicy.set(true);
    component.signatureName.set('Avery Bloom');

    await component.confirmAccept();
    fixture.detectChanges();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProposalReviewComponent] confirmAccept error:',
      jasmine.any(Error)
    );
    expect(component.acceptModalState()).toBe('confirm');
    expect(component.errorMessage()).toBe('Response window closed.');
    expect(component.completedAction()).toBeNull();
  });

  it('requires decline notes before submitting a declined response', async () => {
    createComponent();
    component.openDeclineModal();
    component.declineFeedback.set('   ');

    await component.confirmDecline();
    fixture.detectChanges();

    expect(proposalAccess.submitResponse).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe(
      'Please share a few notes so we can revise the Floral Proposal thoughtfully.'
    );
  });

  it('submits declined responses with trimmed feedback and success state', async () => {
    proposalAccess.submitResponse.and.resolveTo({
      success: true,
      lead_status: 'proposal_declined',
      action: 'decline',
    });
    createComponent();
    component.openDeclineModal();
    component.declineFeedback.set('  Please revise the bouquet palette.  ');

    await component.confirmDecline();
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
  });

  it('shows fallback decline errors and signs out through the auth route', async () => {
    proposalAccess.submitResponse.and.rejectWith('offline');
    createComponent();
    component.openDeclineModal();
    component.declineFeedback.set('Please simplify the design.');

    await component.confirmDecline();
    await component.signOut();
    fixture.detectChanges();

    expect(component.declineModalState()).toBe('form');
    expect(component.errorMessage()).toBe('We could not save your response right now.');
    expect(proposalAccess.clearSession).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/proposal/auth']);
  });

  it('formats empty date values as not provided', () => {
    createComponent();

    expect(component.formatDate(null)).toBe('Not provided');
    expect(component.formatDateTime(undefined)).toBe('Not provided');
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
      pdf_url: 'https://example.test/proposal.pdf',
      response_action: null,
      response_feedback: null,
      responded_at: null,
      ...overrides,
    };
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }

  function anchor(selector: string): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  function iframe(): HTMLIFrameElement | null {
    return fixture.nativeElement.querySelector('iframe');
  }
});
