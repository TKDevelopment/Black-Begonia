import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    })
      .overrideComponent(LoginComponent, { set: { template: '' } })
      .compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('marks fields touched and skips submit when the form is invalid', async () => {
    await component.submit();

    expect(component.emailControl.touched).toBeTrue();
    expect(component.passwordControl.touched).toBeTrue();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('toggles password visibility', () => {
    expect(component.showPassword()).toBeFalse();

    component.togglePasswordVisibility();
    expect(component.showPassword()).toBeTrue();

    component.togglePasswordVisibility();
    expect(component.showPassword()).toBeFalse();
  });

  it('shows authentication errors without navigating', async () => {
    component.form.setValue({
      email: 'staff@example.test',
      password: 'hunter2',
    });
    authService.login.and.resolveTo('Invalid credentials');

    await component.submit();

    expect(authService.login).toHaveBeenCalledWith(
      'staff@example.test',
      'hunter2'
    );
    expect(component.errorMessage()).toBe('Invalid credentials');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBeFalse();
  });

  it('navigates after a successful login', async () => {
    component.form.setValue({
      email: 'staff@example.test',
      password: 'hunter2',
    });
    authService.login.and.resolveTo(null);

    await component.submit();

    expect(component.errorMessage()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    expect(component.isSubmitting()).toBeFalse();
  });

  it('shows a fallback error when login throws', async () => {
    const error = new Error('network down');
    component.form.setValue({
      email: 'staff@example.test',
      password: 'hunter2',
    });
    authService.login.and.rejectWith(error);

    await component.submit();

    expect(consoleErrorSpy).toHaveBeenCalledWith('[LoginComponent] submit error:', error);
    expect(component.errorMessage()).toBe(
      'Something went wrong while signing in. Please try again.'
    );
    expect(component.isSubmitting()).toBeFalse();
  });
});
