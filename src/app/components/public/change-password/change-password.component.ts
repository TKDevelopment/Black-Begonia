import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/clients/supabase.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './change-password.component.html',
})
export class ChangePasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly isReady = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  async ngOnInit(): Promise<void> {
    try {
      const session = await this.supabaseService.getSession();

      if (!session?.user) {
        this.errorMessage.set('This password reset link is invalid or has expired.');
      }
    } catch (error) {
      console.error('[ChangePasswordComponent] init error:', error);
      this.errorMessage.set('Unable to verify your reset session.');
    } finally {
      this.isReady.set(true);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { password, confirmPassword } = this.form.getRawValue();

    if (password !== confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const error = await this.authService.updatePassword(password);

      if (error) {
        this.errorMessage.set(error);
        return;
      }

      this.successMessage.set('Your password has been updated successfully.');

      setTimeout(() => {
        void this.router.navigate(['/login']);
      }, 1500);
    } catch (error) {
      console.error('[ChangePasswordComponent] submit error:', error);
      this.errorMessage.set('Unable to update your password right now. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  get passwordControl() {
    return this.form.controls.password;
  }

  get confirmPasswordControl() {
    return this.form.controls.confirmPassword;
  }
}