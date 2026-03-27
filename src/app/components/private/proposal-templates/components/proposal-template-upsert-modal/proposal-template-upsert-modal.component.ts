import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DocumentTemplate } from '../../../../../core/models/floral-proposal';

export interface ProposalTemplateUpsertPayload {
  name: string;
  template_key: string;
  is_active: boolean;
  is_default: boolean;
  primary_color?: string | null;
  accent_color?: string | null;
  heading_font_family?: string | null;
  body_font_family?: string | null;
  header_layout: DocumentTemplate['header_layout'];
  line_item_layout: DocumentTemplate['line_item_layout'];
  footer_layout: DocumentTemplate['footer_layout'];
  show_cover_page: boolean;
  show_intro_message: boolean;
  intro_title?: string | null;
  intro_body?: string | null;
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
  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() template: DocumentTemplate | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<ProposalTemplateUpsertPayload>();

  readonly name = signal('');
  readonly templateKey = signal('');
  readonly isActive = signal(true);
  readonly isDefault = signal(false);
  readonly primaryColor = signal('#111111');
  readonly accentColor = signal('#ea938c');
  readonly headingFontFamily = signal('Cormorant Garamond');
  readonly bodyFontFamily = signal('Source Sans 3');
  readonly headerLayout = signal<DocumentTemplate['header_layout']>('editorial');
  readonly lineItemLayout = signal<DocumentTemplate['line_item_layout']>('image_left');
  readonly footerLayout = signal<DocumentTemplate['footer_layout']>('signature_focused');
  readonly showCoverPage = signal(true);
  readonly showIntroMessage = signal(true);
  readonly introTitle = signal('Your Floral Proposal');
  readonly introBody = signal(
    'We are honored to prepare floral designs for your event. Below is your curated floral proposal.'
  );
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
    this.isActive.set(template?.is_active ?? true);
    this.isDefault.set(template?.is_default ?? false);
    this.primaryColor.set(template?.primary_color ?? '#111111');
    this.accentColor.set(template?.accent_color ?? '#ea938c');
    this.headingFontFamily.set(template?.heading_font_family ?? 'Cormorant Garamond');
    this.bodyFontFamily.set(template?.body_font_family ?? 'Source Sans 3');
    this.headerLayout.set(template?.header_layout ?? 'editorial');
    this.lineItemLayout.set(template?.line_item_layout ?? 'image_left');
    this.footerLayout.set(template?.footer_layout ?? 'signature_focused');
    this.showCoverPage.set(template?.show_cover_page ?? true);
    this.showIntroMessage.set(template?.show_intro_message ?? true);
    this.introTitle.set(template?.intro_title ?? 'Your Floral Proposal');
    this.introBody.set(
      template?.intro_body ??
        'We are honored to prepare floral designs for your event. Below is your curated floral proposal.'
    );
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

    if (!templateKey || !/^[a-z0-9-_]+$/.test(templateKey)) {
      this.validationError.set(
        'Template key is required and should only use lowercase letters, numbers, hyphens, or underscores.'
      );
      return null;
    }

    this.validationError.set(null);

    return {
      name,
      template_key: templateKey,
      is_active: this.isActive(),
      is_default: this.isDefault(),
      primary_color: this.primaryColor(),
      accent_color: this.accentColor(),
      heading_font_family: this.headingFontFamily(),
      body_font_family: this.bodyFontFamily(),
      header_layout: this.headerLayout(),
      line_item_layout: this.lineItemLayout(),
      footer_layout: this.footerLayout(),
      show_cover_page: this.showCoverPage(),
      show_intro_message: this.showIntroMessage(),
      intro_title: this.introTitle().trim() || null,
      intro_body: this.introBody().trim() || null,
      show_terms_section: this.showTermsSection(),
      show_privacy_section: this.showPrivacySection(),
      show_signature_section: this.showSignatureSection(),
    };
  }
}
