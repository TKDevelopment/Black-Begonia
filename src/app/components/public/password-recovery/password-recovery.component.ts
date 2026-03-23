import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-password-recovery',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './password-recovery.component.html',
})
export class PasswordRecoveryComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { email } = this.form.getRawValue();

    try {
      const error = await this.authService.requestPasswordReset(email);

      if (error) {
        this.errorMessage.set(error);
        return;
      }

      this.successMessage.set(
        'A password reset link has been sent to your email address.'
      );
      this.form.reset({ email: '' });
    } catch (error) {
      console.error('[PasswordRecoveryComponent] submit error:', error);
      this.errorMessage.set('Unable to send reset instructions right now. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  get emailControl() {
    return this.form.controls.email;
  }
}