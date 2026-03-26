import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ProposalAccessService } from '../../../core/proposal-access/proposal-access.service';

@Component({
  selector: 'app-proposal-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './proposal-auth.component.html',
})
export class ProposalAuthComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly proposalAccessService = inject(ProposalAccessService);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    passcode: [
      '',
      [Validators.required, Validators.pattern(/^\d{6}$/)],
    ],
  });

  ngOnInit(): void {
    if (this.proposalAccessService.hasValidSession()) {
      void this.router.navigate(['/proposal/review']);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, passcode } = this.form.getRawValue();

    try {
      this.isSubmitting.set(true);
      this.errorMessage.set(null);

      await this.proposalAccessService.verifyAccess(email, passcode);
      await this.router.navigate(['/proposal/review']);
    } catch (error) {
      console.error('[ProposalAuthComponent] submit error:', error);
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'We could not verify your proposal access.'
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  get emailControl() {
    return this.form.controls.email;
  }

  get passcodeControl() {
    return this.form.controls.passcode;
  }
}

