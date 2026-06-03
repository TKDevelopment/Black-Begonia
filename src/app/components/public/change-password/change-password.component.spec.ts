import { fakeAsync, tick } from '@angular/core/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SupabaseService } from '../../../core/supabase/clients/supabase.service';
import { ChangePasswordComponent } from './change-password.component';

describe('ChangePasswordComponent', () => {
  let component: ChangePasswordComponent;
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let router: jasmine.SpyObj<Router>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['updatePassword']);
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getSession']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    supabaseService.getSession.and.resolveTo({ user: { id: 'user-test-001' } } as never);

    await TestBed.configureTestingModule({
      imports: [ChangePasswordComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SupabaseService, useValue: supabaseService },
        { provide: Router, useValue: router },
      ],
    })
      .overrideComponent(ChangePasswordComponent, { set: { template: '' } })
      .compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
    fixture = TestBed.createComponent(ChangePasswordComponent);
    component = fixture.componentInstance;
  });

  it('marks the reset link invalid when no session user is available', async () => {
    supabaseService.getSession.and.resolveTo(null as never);

    await component.ngOnInit();

    expect(component.errorMessage()).toBe(
      'This password reset link is invalid or has expired.'
    );
    expect(component.isReady()).toBeTrue();
  });

  it('shows an init error when reset-session verification fails', async () => {
    const error = new Error('session check failed');
    supabaseService.getSession.and.rejectWith(error);

    await component.ngOnInit();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ChangePasswordComponent] init error:',
      error
    );
    expect(component.errorMessage()).toBe('Unable to verify your reset session.');
    expect(component.isReady()).toBeTrue();
  });

  it('toggles password fields and validates mismatched passwords', async () => {
    component.togglePasswordVisibility();
    component.toggleConfirmPasswordVisibility();

    expect(component.showPassword()).toBeTrue();
    expect(component.showConfirmPassword()).toBeTrue();

    component.form.setValue({
      password: 'password1',
      confirmPassword: 'password2',
    });

    await component.submit();

    expect(component.errorMessage()).toBe('Passwords do not match.');
    expect(authService.updatePassword).not.toHaveBeenCalled();
  });

  it('shows auth-service validation errors without navigating', async () => {
    component.form.setValue({
      password: 'password1',
      confirmPassword: 'password1',
    });
    authService.updatePassword.and.resolveTo('Password too weak');

    await component.submit();

    expect(component.errorMessage()).toBe('Password too weak');
    expect(component.successMessage()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBeFalse();
  });

  it('shows a fallback error when password updates throw', async () => {
    const error = new Error('update failed');
    component.form.setValue({
      password: 'password1',
      confirmPassword: 'password1',
    });
    authService.updatePassword.and.rejectWith(error);

    await component.submit();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ChangePasswordComponent] submit error:',
      error
    );
    expect(component.errorMessage()).toBe(
      'Unable to update your password right now. Please try again.'
    );
    expect(component.isSubmitting()).toBeFalse();
  });

  it('shows success feedback and navigates back to login after a successful update', fakeAsync(() => {
    component.form.setValue({
      password: 'password1',
      confirmPassword: 'password1',
    });
    authService.updatePassword.and.resolveTo(null);

    void component.submit();
    tick();

    expect(component.successMessage()).toBe('Your password has been updated successfully.');
    expect(component.errorMessage()).toBeNull();

    tick(1500);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(component.isSubmitting()).toBeFalse();
  }));
});
