import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DocumentTemplate } from '../../../../../core/models/floral-proposal';
import {
  PROPOSAL_RENDERER_OPTIONS,
  ProposalRendererKey,
  resolveTemplateRendererKey,
} from '../../../../../core/proposal-templates/proposal-renderer-registry';

export interface ProposalTemplateUpsertPayload {
  name: string;
  template_key: string;
  renderer_key: ProposalRendererKey;
  is_active: boolean;
  is_default: boolean;
  show_terms_section: boolean;
  show_privacy_section: boolean;
  show_signature_section: boolean;
}

@Component({
  selector: 'app-proposal-template-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-template-upsert-modal.component.html',
})
export class ProposalTemplateUpsertModalComponent {
  readonly rendererOptions = PROPOSAL_RENDERER_OPTIONS;

  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() template: DocumentTemplate | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<ProposalTemplateUpsertPayload>();

  readonly name = signal('');
  readonly templateKey = signal('');
  readonly rendererKey = signal<ProposalRendererKey>('general-event');
  readonly isActive = signal(true);
  readonly isDefault = signal(false);
  readonly showTermsSection = signal(true);
  readonly showPrivacySection = signal(true);
  readonly showSignatureSection = signal(true);
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || (changes['template'] && this.open)) {
      this.hydrateForm();
    }
  }

  get title(): string {
    return this.mode === 'create' ? 'Create Proposal Template' : 'Edit Proposal Template';
  }

  get confirmLabel(): string {
    if (this.saving) {
      return this.mode === 'create' ? 'Creating...' : 'Saving...';
    }

    return this.mode === 'create' ? 'Create Template' : 'Save Changes';
  }

  get rendererDescription(): string {
    return (
      this.rendererOptions.find((option) => option.key === this.rendererKey())?.description ??
      'Choose the renderer strategy that best matches this floral service.'
    );
  }

  onClose(): void {
    if (this.saving) return;
    this.validationError.set(null);
    this.close.emit();
  }

  onConfirm(): void {
    const payload = this.buildPayload();
    if (!payload) return;
    this.confirm.emit(payload);
  }

  private hydrateForm(): void {
    const template = this.template;

    this.name.set(template?.name ?? '');
    this.templateKey.set(template?.template_key ?? '');
    this.rendererKey.set(resolveTemplateRendererKey(template));
    this.isActive.set(template?.is_active ?? true);
    this.isDefault.set(template?.is_default ?? false);
    this.showTermsSection.set(template?.show_terms_section ?? true);
    this.showPrivacySection.set(template?.show_privacy_section ?? true);
    this.showSignatureSection.set(template?.show_signature_section ?? true);
    this.validationError.set(null);
  }

  private buildPayload(): ProposalTemplateUpsertPayload | null {
    const name = this.name().trim();
    const templateKey = this.templateKey().trim().toLowerCase();

    if (!name) {
      this.validationError.set('Template name is required.');
      return null;
    }

    if (!/^[a-z0-9-_]+$/.test(templateKey)) {
      this.validationError.set(
        'Template key must use lowercase letters, numbers, dashes, or underscores only.'
      );
      return null;
    }

    this.validationError.set(null);

    return {
      name,
      template_key: templateKey,
      renderer_key: this.rendererKey(),
      is_active: this.isActive(),
      is_default: this.isDefault(),
      show_terms_section: this.showTermsSection(),
      show_privacy_section: this.showPrivacySection(),
      show_signature_section: this.showSignatureSection(),
    };
  }
}
