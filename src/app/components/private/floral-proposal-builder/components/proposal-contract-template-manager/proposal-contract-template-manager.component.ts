import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ProposalContractTemplate,
  ProposalContractTemplateUpsertInput,
} from '../../../../../core/models/proposal-contract-template';

@Component({
  selector: 'app-proposal-contract-template-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-contract-template-manager.component.html',
})
export class ProposalContractTemplateManagerComponent {
  @Input() templates: ProposalContractTemplate[] = [];
  @Input() activeTemplateId: string | null = null;
  @Input() saving = false;
  @Input() errorMessage: string | null = null;

  @Output() createTemplate = new EventEmitter<ProposalContractTemplateUpsertInput>();
  @Output() activateTemplate = new EventEmitter<string>();

  readonly displayName = signal('');
  readonly providerTemplateId = signal('');
  readonly providerTemplateName = signal('');
  readonly providerTemplateRevision = signal('');
  readonly description = signal('');
  readonly requiredFieldMapJson = signal(
    '{\n  "customer_name": "lead.full_name",\n  "customer_email": "lead.email",\n  "__signwell": {\n    "contract_pdf_url": "https://provider.example/contracts/current.pdf"\n  }\n}'
  );
  readonly formError = signal<string | null>(null);

  submit(): void {
    const displayName = this.displayName().trim();
    const providerTemplateId = this.providerTemplateId().trim();
    const providerTemplateName = this.providerTemplateName().trim();

    if (!displayName || !providerTemplateId || !providerTemplateName) {
      this.formError.set(
        'Display name, provider template ID, and provider template name are required.'
      );
      return;
    }

    try {
      const requiredFieldMap = JSON.parse(this.requiredFieldMapJson().trim() || '{}') as Record<
        string,
        unknown
      >;

      this.formError.set(null);
      this.createTemplate.emit({
        provider: 'signwell',
        provider_template_id: providerTemplateId,
        provider_template_name: providerTemplateName,
        provider_template_revision: this.providerTemplateRevision().trim() || null,
        display_name: displayName,
        description: this.description().trim() || null,
        required_field_map: requiredFieldMap,
        is_active: true,
      });

      this.resetForm();
    } catch {
      this.formError.set('Required field map must be valid JSON.');
    }
  }

  onActivate(templateId: string): void {
    if (this.saving || templateId === this.activeTemplateId) return;
    this.activateTemplate.emit(templateId);
  }

  private resetForm(): void {
    this.displayName.set('');
    this.providerTemplateId.set('');
    this.providerTemplateName.set('');
    this.providerTemplateRevision.set('');
    this.description.set('');
    this.requiredFieldMapJson.set(
      '{\n  "customer_name": "lead.full_name",\n  "customer_email": "lead.email",\n  "__signwell": {\n    "contract_pdf_url": "https://provider.example/contracts/current.pdf"\n  }\n}'
    );
  }
}
