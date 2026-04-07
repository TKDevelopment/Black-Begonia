import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  DocumentTemplate,
  GrapesJsStoredTemplateConfig,
} from '../../../core/models/floral-proposal';
import { GrapeJsTemplateStudioService } from '../../../core/proposal-templates/grapejs-template-studio.service';
import {
  getProposalRendererOption,
  resolveTemplateRendererKey,
  withTemplateRendererKey,
} from '../../../core/proposal-templates/proposal-renderer-registry';
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
          show_terms_section: payload.show_terms_section,
          show_privacy_section: payload.show_privacy_section,
          show_signature_section: payload.show_signature_section,
          template_config: withTemplateRendererKey({}, payload.renderer_key),
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
        show_terms_section: payload.show_terms_section,
        show_privacy_section: payload.show_privacy_section,
        show_signature_section: payload.show_signature_section,
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

  openStudio(template: DocumentTemplate): void {
    void this.router.navigate(['/admin/proposal-templates', template.template_id, 'studio']);
  }

  getRendererLabel(template: DocumentTemplate): string {
    return (
      getProposalRendererOption(resolveTemplateRendererKey(template))?.label ??
      'General Event'
    );
  }

  private buildTemplateConfig(
    template: DocumentTemplate,
    payload: ProposalTemplateUpsertPayload
  ): Record<string, unknown> {
    const existingStoredConfig = this.templateStudio.getStoredConfig(template);

    if (existingStoredConfig) {
      const nextStoredConfig: GrapesJsStoredTemplateConfig = {
        ...existingStoredConfig,
        settings: {
          ...existingStoredConfig.settings,
          show_terms_section: payload.show_terms_section,
          show_privacy_section: payload.show_privacy_section,
          show_signature_section: payload.show_signature_section,
        },
      };

      return withTemplateRendererKey(
        this.templateStudio.buildTemplateConfig(template, nextStoredConfig),
        payload.renderer_key
      );
    }

    return withTemplateRendererKey(template.template_config, payload.renderer_key);
  }
}
