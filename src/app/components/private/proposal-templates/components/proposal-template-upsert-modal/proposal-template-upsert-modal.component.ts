import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DocumentTemplate } from '../../../../../core/models/floral-proposal';
import {
  PROPOSAL_RENDERER_OPTIONS,
  ProposalRendererKey,
  resolveTemplateRendererKey,
} from '../../../../../core/proposal-templates/proposal-renderer-registry';
import { getProposalRendererStrategy } from '../../../../../core/proposal-templates/proposal-renderer-strategies';
import {
  getTemplateServiceProfile,
  hasProposalTemplateServiceProfile,
  normalizeProposalTemplateServiceProfile,
  ProposalTemplateServiceProfile,
  PROPOSAL_TEMPLATE_FINAL_BALANCE_MODE_OPTIONS,
} from '../../../../../core/proposal-templates/proposal-template-service-profile';
import {
  getProposalTemplatePreset,
  getProposalTemplateServiceProfilePreset,
  ProposalTemplatePreset,
} from '../../../../../core/proposal-templates/proposal-template-presets';

type ServiceProfileFieldKey = Exclude<keyof ProposalTemplateServiceProfile, 'finalBalanceMode'>;

interface ServiceProfileFieldDefinition {
  key: ServiceProfileFieldKey;
  label: string;
  description: string;
  rows?: number;
  fullWidth?: boolean;
}

export interface ProposalTemplateUpsertPayload {
  name: string;
  template_key: string;
  renderer_key: ProposalRendererKey;
  is_active: boolean;
  is_default: boolean;
  service_profile: ProposalTemplateServiceProfile;
}

@Component({
  selector: 'app-proposal-template-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-template-upsert-modal.component.html',
})
export class ProposalTemplateUpsertModalComponent {
  readonly rendererOptions = PROPOSAL_RENDERER_OPTIONS;
  readonly finalBalanceModeOptions = PROPOSAL_TEMPLATE_FINAL_BALANCE_MODE_OPTIONS;
  readonly supportedTokens = [
    '{{customer_name}}',
    '{{service_type}}',
    '{{event_date}}',
    '{{delivery_setup_location}}',
    '{{final_balance_due_date}}',
  ];
  readonly framingFields: ServiceProfileFieldDefinition[] = [
    {
      key: 'documentTitle',
      label: 'Document Title',
      description: 'Used for the rendered document title and shared fallback header copy.',
    },
    {
      key: 'agreementTitle',
      label: 'Agreement Title',
      description: 'Main agreement heading shown across fallback render output and Studio starter fields.',
    },
    {
      key: 'lineItemsKicker',
      label: 'Line Items Kicker',
      description: 'Small overline above the line-item section.',
    },
    {
      key: 'lineItemsTitle',
      label: 'Line Items Title',
      description: 'Primary heading for the line-item section.',
    },
    {
      key: 'pricingEyebrow',
      label: 'Investment Eyebrow',
      description: 'Small label above the totals or investment card.',
    },
    {
      key: 'investmentTitle',
      label: 'Investment Title',
      description: 'Primary heading for the totals or investment section.',
    },
  ];
  readonly contractLabelFields: ServiceProfileFieldDefinition[] = [
    {
      key: 'detailsSectionTitle',
      label: 'Details Section Title',
      description: 'Heading used for the event or service details table.',
    },
    {
      key: 'serviceTypeLabel',
      label: 'Service Type Label',
      description: 'Column or row label for the service type field.',
    },
    {
      key: 'serviceDateLabel',
      label: 'Service Date Label',
      description: 'Column or row label for the event or service date.',
    },
    {
      key: 'deliveryLocationLabel',
      label: 'Location Label',
      description: 'Column or row label for delivery, setup, or service location.',
    },
    {
      key: 'paymentTermsTitle',
      label: 'Payment Terms Title',
      description: 'Heading used for the payment-terms section.',
    },
    {
      key: 'retainerLabel',
      label: 'Retainer Label',
      description: 'Label for the retainer, deposit, or approval row.',
    },
    {
      key: 'finalBalanceLabel',
      label: 'Final Balance Label',
      description: 'Label for the due-date or billing-schedule row.',
    },
    {
      key: 'finalBalanceFallback',
      label: 'Final Balance Fallback',
      description: 'Shown when no event date exists or when the selected due mode uses copy instead of a calculated date.',
    },
    {
      key: 'latePaymentLabel',
      label: 'Late Payment Label',
      description: 'Label for the final payment or billing notes row.',
    },
  ];
  readonly contractCopyFields: ServiceProfileFieldDefinition[] = [
    {
      key: 'retainerCopy',
      label: 'Retainer Copy',
      description: 'Main copy describing what must be signed or paid to reserve service.',
      rows: 4,
      fullWidth: true,
    },
    {
      key: 'latePaymentCopy',
      label: 'Late Payment Copy',
      description: 'Copy describing what happens if payment is delayed.',
      rows: 4,
      fullWidth: true,
    },
    {
      key: 'privacyTitle',
      label: 'Privacy Title',
      description: 'Heading for the privacy section.',
    },
    {
      key: 'privacyCopy',
      label: 'Privacy Copy',
      description: 'Privacy language rendered in the agreement section.',
      rows: 4,
      fullWidth: true,
    },
    {
      key: 'signatureTitle',
      label: 'Signature Title',
      description: 'Heading for the signature and acceptance section.',
    },
    {
      key: 'floristSignatureParty',
      label: 'Florist Signature Party',
      description: 'Name shown above the florist signature block.',
    },
    {
      key: 'clientSignatureParty',
      label: 'Client Signature Party',
      description: 'Name or label shown above the client signature block. Tokens are supported here.',
    },
  ];

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
  readonly serviceProfile = signal<ProposalTemplateServiceProfile>({});
  readonly appliedPresetKey = signal<ProposalRendererKey | null>(null);
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

  get hasServiceProfileOverrides(): boolean {
    return hasProposalTemplateServiceProfile(this.serviceProfile());
  }

  get finalBalanceModeValue(): string {
    return this.serviceProfile().finalBalanceMode ?? '';
  }

  get finalBalanceModeDefaultLabel(): string {
    const defaultMode = getProposalRendererStrategy(this.rendererKey()).finalBalanceMode;
    return (
      this.finalBalanceModeOptions.find((option) => option.value === defaultMode)?.label ??
      'Renderer default'
    );
  }

  get finalBalanceModeDescription(): string {
    return (
      this.finalBalanceModeOptions.find((option) => option.value === this.finalBalanceModeValue)
        ?.description ??
      'Keep this blank if the renderer strategy should decide how due dates are calculated.'
    );
  }

  get recommendedPreset(): ProposalTemplatePreset | null {
    return getProposalTemplatePreset(this.rendererKey());
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

  updateRendererKey(value: ProposalRendererKey): void {
    const shouldSyncPreset =
      this.mode === 'create' &&
      (!!this.appliedPresetKey() || !hasProposalTemplateServiceProfile(this.serviceProfile()));

    this.rendererKey.set(value);

    if (shouldSyncPreset) {
      this.applyRecommendedServiceProfile();
    }
  }

  getServiceProfileValue(key: ServiceProfileFieldKey): string {
    return this.serviceProfile()[key] ?? '';
  }

  getServiceProfileDefault(key: ServiceProfileFieldKey): string {
    const value = getProposalRendererStrategy(this.rendererKey())[key];
    return typeof value === 'string' ? value : '';
  }

  updateServiceProfileValue(key: ServiceProfileFieldKey, value: string): void {
    this.serviceProfile.update(
      (current) =>
        ({
          ...current,
          [key]: value ?? '',
        }) as ProposalTemplateServiceProfile
    );
    this.appliedPresetKey.set(null);
  }

  updateFinalBalanceMode(value: string): void {
    const nextValue =
      this.finalBalanceModeOptions.find((option) => option.value === value)?.value;

    this.serviceProfile.update((current) => ({
      ...current,
      finalBalanceMode: nextValue,
    }));
    this.appliedPresetKey.set(null);
  }

  applyRecommendedServiceProfile(): void {
    const presetProfile = getProposalTemplateServiceProfilePreset(this.rendererKey());
    this.serviceProfile.set(presetProfile);
    this.appliedPresetKey.set(
      Object.keys(presetProfile).length ? this.rendererKey() : null
    );
  }

  clearServiceProfileOverrides(): void {
    this.serviceProfile.set({});
    this.appliedPresetKey.set(null);
  }

  private hydrateForm(): void {
    const template = this.template;

    this.name.set(template?.name ?? '');
    this.templateKey.set(template?.template_key ?? '');
    this.rendererKey.set(resolveTemplateRendererKey(template));
    this.isActive.set(template?.is_active ?? true);
    this.isDefault.set(template?.is_default ?? false);
    this.serviceProfile.set(getTemplateServiceProfile(template));
    this.appliedPresetKey.set(null);
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
      service_profile: normalizeProposalTemplateServiceProfile(this.serviceProfile()),
    };
  }
}
