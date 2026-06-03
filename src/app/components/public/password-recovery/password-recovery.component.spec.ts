import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { PasswordRecoveryComponent } from './password-recovery.component';

describe('PasswordRecoveryComponent', () => {
  let component: PasswordRecoveryComponent;
  let fixture: ComponentFixture<PasswordRecoveryComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'requestPasswordReset',
    ]);

    await TestBed.configureTestingModule({
      imports: [PasswordRecoveryComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideComponent(PasswordRecoveryComponent, { set: { template: '' } })
      .compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
    fixture = TestBed.createComponent(PasswordRecoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('marks the email field touched and skips submit when invalid', async () => {
    await component.submit();

    expect(component.emailControl.touched).toBeTrue();
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('shows auth errors from the password reset request', async () => {
    component.form.setValue({ email: 'staff@example.test' });
    authService.requestPasswordReset.and.resolveTo('Reset failed');

    await component.submit();

    expect(component.errorMessage()).toBe('Reset failed');
    expect(component.successMessage()).toBeNull();
    expect(component.isSubmitting()).toBeFalse();
  });

  it('shows success feedback and resets the form after a successful request', async () => {
    component.form.setValue({ email: 'staff@example.test' });
    authService.requestPasswordReset.and.resolveTo(null);

    await component.submit();

    expect(component.successMessage()).toBe(
      'A password reset link has been sent to your email address.'
    );
    expect(component.form.getRawValue().email).toBe('');
    expect(component.errorMessage()).toBeNull();
    expect(component.isSubmitting()).toBeFalse();
  });

  it('shows a fallback error when the reset request throws', async () => {
    const error = new Error('email service down');
    component.form.setValue({ email: 'staff@example.test' });
    authService.requestPasswordReset.and.rejectWith(error);

    await component.submit();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[PasswordRecoveryComponent] submit error:',
      error
    );
    expect(component.errorMessage()).toBe(
      'Unable to send reset instructions right now. Please try again.'
    );
    expect(component.isSubmitting()).toBeFalse();
  });
});
