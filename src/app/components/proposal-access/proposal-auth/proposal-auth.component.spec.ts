import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ProposalAccessService } from '../../../core/proposal-access/proposal-access.service';
import { ProposalAuthComponent } from './proposal-auth.component';

describe('ProposalAuthComponent', () => {
  let component: ProposalAuthComponent;
  let fixture: ComponentFixture<ProposalAuthComponent>;
  let proposalAccess: jasmine.SpyObj<ProposalAccessService>;
  let router: jasmine.SpyObj<Router>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(async () => {
    proposalAccess = jasmine.createSpyObj<ProposalAccessService>(
      'ProposalAccessService',
      ['hasValidSession', 'verifyAccess']
    );
    proposalAccess.hasValidSession.and.returnValue(false);
    proposalAccess.verifyAccess.and.resolveTo({} as any);

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [ProposalAuthComponent],
      providers: [
        { provide: ProposalAccessService, useValue: proposalAccess },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
  });

  it('redirects to review when a valid proposal access session already exists', () => {
    proposalAccess.hasValidSession.and.returnValue(true);

    createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/proposal/review']);
  });

  it('renders the access form without redirecting when no valid session exists', () => {
    createComponent();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(text()).toContain('Secure Floral Proposal Review');
    expect(text()).toContain('Sign in to view');
    expect(input('#proposal-email')?.getAttribute('autocomplete')).toBe('email');
    expect(input('#proposal-passcode')?.getAttribute('maxlength')).toBe('6');
  });

  it('marks invalid fields and does not verify access on invalid submit', async () => {
    createComponent();

    await component.submit();
    fixture.detectChanges();

    expect(component.emailControl.touched).toBeTrue();
    expect(component.passcodeControl.touched).toBeTrue();
    expect(text()).toContain('Please enter a valid email address.');
    expect(text()).toContain('Enter the 6-digit passcode');
    expect(proposalAccess.verifyAccess).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('verifies valid credentials, shows loading copy, and navigates to review', async () => {
    let resolveVerify!: () => void;
    proposalAccess.verifyAccess.and.returnValue(
      new Promise((resolve) => {
        resolveVerify = () => resolve({} as any);
      })
    );
    createComponent();
    component.form.setValue({
      email: 'client@example.test',
      passcode: '123456',
    });

    const submitPromise = component.submit();
    fixture.detectChanges();

    expect(component.isSubmitting()).toBeTrue();
    expect(text()).toContain('Verifying...');
    expect(proposalAccess.verifyAccess).toHaveBeenCalledWith(
      'client@example.test',
      '123456'
    );

    resolveVerify();
    await submitPromise;
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/proposal/review']);
    expect(component.isSubmitting()).toBeFalse();
    expect(text()).toContain('View Floral Proposal');
  });

  it('renders verification errors and resets loading state', async () => {
    proposalAccess.verifyAccess.and.rejectWith(new Error('Invalid passcode.'));
    createComponent();
    component.form.setValue({
      email: 'client@example.test',
      passcode: '000000',
    });

    await component.submit();
    fixture.detectChanges();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProposalAuthComponent] submit error:',
      jasmine.any(Error)
    );
    expect(component.errorMessage()).toBe('Invalid passcode.');
    expect(text()).toContain('Invalid passcode.');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBeFalse();
  });

  it('uses a fallback message for non-error verification failures', async () => {
    proposalAccess.verifyAccess.and.rejectWith('offline');
    createComponent();
    component.form.setValue({
      email: 'client@example.test',
      passcode: '123456',
    });

    await component.submit();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe(
      'We could not verify your Floral Proposal access.'
    );
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ProposalAuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }

  function input(selector: string): HTMLInputElement | null {
    return fixture.nativeElement.querySelector(selector);
  }
});
