import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  DocumentTemplate,
} from '../../../core/models/floral-proposal';
import { GrapeJsTemplateStudioService } from '../../../core/proposal-templates/grapejs-template-studio.service';
import {
  getProposalRendererOption,
  resolveTemplateRendererKey,
  withTemplateRendererKey,
} from '../../../core/proposal-templates/proposal-renderer-registry';
import { withTemplateServiceProfile } from '../../../core/proposal-templates/proposal-template-service-profile';
import { getProposalTemplateServiceProfilePreset } from '../../../core/proposal-templates/proposal-template-presets';
import { ToastService } from '../../../core/services/toast.service';
import { DocumentTemplateRepositoryService } from '../../../core/supabase/repositories/document-template-repository.service';
import { DocumentTemplateService } from '../../../core/supabase/services/document-template.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { StatusBadgeComponent } from '../../../shared/components/private/status-badge/status-badge.component';
import {
  ProposalTemplateUpsertModalComponent,
  ProposalTemplateUpsertPayload,
} from './components/proposal-template-upsert-modal/proposal-template-upsert-modal.component';

@Component({
  selector: 'app-proposal-templates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CrmPageHeaderComponent,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
    StatusBadgeComponent,
    ProposalTemplateUpsertModalComponent,
  ],
  templateUrl: './proposal-templates.component.html',
  styleUrl: './proposal-templates.component.scss',
})
export class ProposalTemplatesComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly documentTemplateRepository = inject(DocumentTemplateRepositoryService);
  private readonly documentTemplateService = inject(DocumentTemplateService);
  private readonly templateStudio = inject(GrapeJsTemplateStudioService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly templates = signal<DocumentTemplate[]>([]);
  readonly searchTerm = signal('');
  readonly modalOpen = signal(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly selectedTemplate = signal<DocumentTemplate | null>(null);

  readonly filteredTemplates = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.templates().filter((template) => {
      if (!term) return true;
      return [
        template.name,
        template.template_key,
        this.getRendererLabel(template),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  });

  ngOnInit(): void {
    void this.loadTemplates();
  }

  async loadTemplates(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.templates.set(await this.documentTemplateRepository.getDocumentTemplates());
    } catch (error) {
      console.error('[ProposalTemplatesComponent] loadTemplates error:', error);
      this.error.set('We were unable to load proposal templates right now.');
    } finally {
      this.loading.set(false);
    }
  }

  updateSearch(value: string): void {
    this.searchTerm.set(value);
  }

  openCreateModal(): void {
    this.modalMode.set('create');
    this.selectedTemplate.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(template: DocumentTemplate): void {
    this.modalMode.set('edit');
    this.selectedTemplate.set(template);
    this.modalOpen.set(true);
  }

  closeTemplateModal(): void {
    if (this.saving()) return;
    this.resetModalState();
  }

  private resetModalState(): void {
    this.modalOpen.set(false);
    this.selectedTemplate.set(null);
    this.modalMode.set('create');
  }

  async saveTemplateRecord(payload: ProposalTemplateUpsertPayload): Promise<void> {
    try {
      this.saving.set(true);

      if (this.modalMode() === 'create') {
        const template = await this.documentTemplateService.createDocumentTemplate({
          name: payload.name,
          template_key: payload.template_key,
          is_active: payload.is_active,
          is_default: payload.is_default,
          template_config: withTemplateServiceProfile(
            withTemplateRendererKey({}, payload.renderer_key),
            Object.keys(payload.service_profile).length
              ? payload.service_profile
              : getProposalTemplateServiceProfilePreset(payload.renderer_key)
          ),
        });

        this.resetModalState();
        this.toast.showToast('Proposal template created.', 'success');
        await this.loadTemplates();
        await this.router.navigate(['/admin/proposal-templates', template.template_id, 'studio']);
        return;
      }

      const template = this.selectedTemplate();
      if (!template) {
        throw new Error('A proposal template is required to save changes.');
      }

      await this.documentTemplateService.updateDocumentTemplate(template.template_id, {
        name: payload.name,
        template_key: payload.template_key,
        is_active: payload.is_active,
        is_default: payload.is_default,
        template_config: this.buildTemplateConfig(template, payload),
      });

      this.resetModalState();
      this.toast.showToast('Proposal template updated.', 'success');
      await this.loadTemplates();
    } catch (error) {
      console.error('[ProposalTemplatesComponent] saveTemplateRecord error:', error);
      this.toast.showToast('We were unable to save the proposal template right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleTemplate(template: DocumentTemplate): Promise<void> {
    try {
      this.saving.set(true);
      if (template.is_active) {
        await this.documentTemplateService.deactivateTemplate(template);
      } else {
        await this.documentTemplateService.activateTemplate(template);
      }
      await this.loadTemplates();
    } catch (error) {
      console.error('[ProposalTemplatesComponent] toggleTemplate error:', error);
      this.toast.showToast('We were unable to update the template status right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteTemplate(template: DocumentTemplate): Promise<void> {
    try {
      this.saving.set(true);
      await this.documentTemplateService.deleteTemplate(template);
      this.toast.showToast('Proposal template deleted permanently.', 'success');
      await this.loadTemplates();
    } catch (error) {
      console.error('[ProposalTemplatesComponent] deleteTemplate error:', error);
      this.toast.showToast(this.getDeleteTemplateErrorMessage(error), 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async requestDeleteTemplate(template: DocumentTemplate): Promise<void> {
    if (this.saving()) return;

    const confirmed = window.confirm(
      `Delete ${template.name} permanently? This cannot be undone. If the template is still linked to existing floral proposals, deletion will be blocked.`
    );

    if (!confirmed) {
      return;
    }

    await this.deleteTemplate(template);
  }

  openStudio(template: DocumentTemplate): void {
    void this.router.navigate(['/admin/proposal-templates', template.template_id, 'studio']);
  }

  getRendererLabel(template: DocumentTemplate): string {
    return (
      getProposalRendererOption(resolveTemplateRendererKey(template))?.label ??
      'Event Standard'
    );
  }

  private buildTemplateConfig(
    template: DocumentTemplate,
    payload: ProposalTemplateUpsertPayload
  ): Record<string, unknown> {
    const existingStoredConfig = this.templateStudio.getStoredConfig(template);

    if (existingStoredConfig) {
      return withTemplateRendererKey(
        withTemplateServiceProfile(
          this.templateStudio.buildTemplateConfig(template, existingStoredConfig),
          payload.service_profile
        ),
        payload.renderer_key
      );
    }

    return withTemplateRendererKey(
      withTemplateServiceProfile(template.template_config, payload.service_profile),
      payload.renderer_key
    );
  }

  private getDeleteTemplateErrorMessage(error: unknown): string {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error['code'] ?? '')
        : '';
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String(error['message'] ?? '').toLowerCase()
        : '';

    if (
      code === '23503' ||
      message.includes('foreign key') ||
      message.includes('constraint') ||
      message.includes('referenc')
    ) {
      return 'This template is still linked to existing proposal records and cannot be deleted yet.';
    }

    return 'We were unable to delete the proposal template right now.';
  }
}
