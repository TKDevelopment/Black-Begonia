import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DocumentTemplate } from '../../../core/models/floral-proposal';
import { GrapeJsTemplateStudioService } from '../../../core/proposal-templates/grapejs-template-studio.service';
import { ToastService } from '../../../core/services/toast.service';
import { DocumentTemplateRepositoryService } from '../../../core/supabase/repositories/document-template-repository.service';
import { DocumentTemplateService } from '../../../core/supabase/services/document-template.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';

@Component({
  selector: 'app-proposal-templates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CrmPageHeaderComponent,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
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
  readonly showCreateForm = signal(false);
  readonly searchTerm = signal('');
  readonly starterTemplates = this.templateStudio.starterTemplates;

  readonly form = signal({
    name: '',
    template_key: '',
    is_active: true,
    is_default: false,
  });

  readonly filteredTemplates = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.templates().filter((template) => {
      if (!term) return true;
      return [template.name, template.template_key].join(' ').toLowerCase().includes(term);
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

  openCreateForm(): void {
    this.form.set({
      name: '',
      template_key: '',
      is_active: true,
      is_default: false,
    });
    this.showCreateForm.set(true);
  }

  closeCreateForm(): void {
    if (this.saving()) return;
    this.showCreateForm.set(false);
  }

  updateForm<K extends keyof ReturnType<typeof this.form>>(key: K, value: ReturnType<typeof this.form>[K]): void {
    this.form.update((form) => ({
      ...form,
      [key]: value,
    }));
  }

  async createTemplate(): Promise<void> {
    const payload = this.form();
    if (!payload.name.trim() || !/^[a-z0-9-_]+$/.test(payload.template_key.trim())) {
      this.toast.showToast('Enter a template name and a lowercase template key.', 'error');
      return;
    }

    try {
      this.saving.set(true);
      const template = await this.documentTemplateService.createDocumentTemplate({
        name: payload.name.trim(),
        template_key: payload.template_key.trim().toLowerCase(),
        is_active: payload.is_active,
        is_default: payload.is_default,
      });
      this.showCreateForm.set(false);
      this.toast.showToast('Proposal template created.', 'success');
      await this.loadTemplates();
      await this.router.navigate(['/admin/proposal-templates', template.template_id, 'studio']);
    } catch (error) {
      console.error('[ProposalTemplatesComponent] createTemplate error:', error);
      this.toast.showToast('We were unable to create the proposal template right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async generateStarterCollection(): Promise<void> {
    const existingKeys = new Set(this.templates().map((template) => template.template_key));
    const startersToCreate = this.starterTemplates.filter(
      (starter) => !existingKeys.has(starter.templateKey)
    );

    if (!startersToCreate.length) {
      this.toast.showToast('The Black Begonia starter collection is already in your registry.', 'success');
      return;
    }

    try {
      this.saving.set(true);

      for (const [index, starter] of startersToCreate.entries()) {
        const created = await this.documentTemplateService.createDocumentTemplate({
          name: starter.name,
          template_key: starter.templateKey,
          is_active: true,
          is_default: index === 0 && !this.templates().some((template) => template.is_default),
          show_terms_section: true,
          show_privacy_section: true,
          show_signature_section: true,
        });

        const config = this.templateStudio.buildStarterConfig(created, starter.id);
        await this.documentTemplateService.updateDocumentTemplate(created.template_id, {
          template_config: this.templateStudio.buildTemplateConfig(created, config),
        });
      }

      await this.loadTemplates();
      this.toast.showToast('Starter proposal templates generated.', 'success');
    } catch (error) {
      console.error('[ProposalTemplatesComponent] generateStarterCollection error:', error);
      this.toast.showToast('We were unable to generate the starter template collection.', 'error');
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
}
