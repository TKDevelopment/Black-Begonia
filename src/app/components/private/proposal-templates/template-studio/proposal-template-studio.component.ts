import { CommonModule, isPlatformBrowser } from '@angular/common';
import '@grapesjs/studio-sdk/style';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StudioCommands, type CreateEditorOptions, type ProjectData } from '@grapesjs/studio-sdk';
import type { Editor } from 'grapesjs';

import { environment } from '../../../../../environments/environment';
import {
  DocumentTemplate,
  GrapesJsStoredTemplateConfig,
} from '../../../../core/models/floral-proposal';
import { GrapeJsTemplateStudioService } from '../../../../core/proposal-templates/grapejs-template-studio.service';
import { CrmThemeService } from '../../../../core/services/crm-theme.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DocumentTemplateRepositoryService } from '../../../../core/supabase/repositories/document-template-repository.service';
import { DocumentTemplateService } from '../../../../core/supabase/services/document-template.service';
import { ErrorStateBlockComponent } from '../../../../shared/components/private/error-state-block/error-state-block.component';
import { LoadingStateBlockComponent } from '../../../../shared/components/private/loading-state-block/loading-state-block.component';

@Component({
  selector: 'app-proposal-template-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingStateBlockComponent, ErrorStateBlockComponent],
  templateUrl: './proposal-template-studio.component.html',
  styleUrl: './proposal-template-studio.component.scss',
})
export class ProposalTemplateStudioComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorHost') editorHost?: ElementRef<HTMLDivElement>;

  readonly templateStudio = inject(GrapeJsTemplateStudioService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly templateRepository = inject(DocumentTemplateRepositoryService);
  private readonly templateService = inject(DocumentTemplateService);
  private readonly crmThemeService = inject(CrmThemeService);
  private readonly toast = inject(ToastService);

  private readonly editorRef = signal<Editor | null>(null);
  private createStudioEditor: ((options: CreateEditorOptions) => Promise<void>) | null = null;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly autosaving = signal(false);
  readonly error = signal<string | null>(null);
  readonly template = signal<DocumentTemplate | null>(null);
  readonly ready = signal(false);
  readonly dirty = signal(false);
  readonly lastDraftSavedAt = signal<string | null>(null);
  readonly form = signal({
    name: '',
    template_key: '',
    is_active: true,
    is_default: false,
    primary_color: '#111111',
    accent_color: '#ea938c',
    heading_font_family: 'Cormorant Garamond',
    body_font_family: 'Source Sans 3',
    show_terms_section: true,
    show_privacy_section: true,
    show_signature_section: true,
  });

  readonly publishedAt = computed(() => this.getStoredConfig()?.published_at ?? null);
  readonly draftSavedAt = computed(() => this.lastDraftSavedAt());

  constructor() {
    effect(() => {
      const editor = this.editorRef();
      const theme = this.getStudioTheme();

      if (!editor) {
        return;
      }

      editor.runCommand(StudioCommands.setStateTheme, { theme });
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const templateId = this.route.snapshot.paramMap.get('templateId');
    if (!templateId) {
      this.error.set('We could not find a proposal template to open.');
      this.loading.set(false);
      return;
    }

    await this.loadTemplate(templateId);
  }

  ngOnDestroy(): void {
    this.destroyEditor();
  }

  updateForm<K extends keyof ReturnType<typeof this.form>>(
    key: K,
    value: ReturnType<typeof this.form>[K]
  ): void {
    this.form.update((form) => ({
      ...form,
      [key]: value,
    }));
    this.dirty.set(true);
  }

  async saveTemplate(): Promise<void> {
    const template = this.template();
    const editor = this.editorRef();
    if (!template || !editor) return;

    const payload = this.form();
    if (!payload.name.trim() || !/^[a-z0-9-_]+$/.test(payload.template_key.trim())) {
      this.toast.showToast('Enter a template name and a lowercase template key.', 'error');
      return;
    }

    try {
      this.saving.set(true);
      const grapesConfig = this.templateStudio.buildPublishedConfig(
        editor,
        this.getStoredConfig()
      );
      grapesConfig.theme = {
        primary_color: payload.primary_color,
        accent_color: payload.accent_color,
        heading_font_family: payload.heading_font_family,
        body_font_family: payload.body_font_family,
      };
      grapesConfig.settings = {
        show_terms_section: payload.show_terms_section,
        show_privacy_section: payload.show_privacy_section,
        show_signature_section: payload.show_signature_section,
      };

      const updated = await this.templateService.updateDocumentTemplate(template.template_id, {
        name: payload.name.trim(),
        template_key: payload.template_key.trim().toLowerCase(),
        is_active: payload.is_active,
        is_default: payload.is_default,
        show_terms_section: payload.show_terms_section,
        show_privacy_section: payload.show_privacy_section,
        show_signature_section: payload.show_signature_section,
        template_config: this.templateStudio.buildTemplateConfig(template, grapesConfig),
      });

      this.template.set(updated);
      this.lastDraftSavedAt.set(new Date().toISOString());
      this.form.set({
        name: updated.name,
        template_key: updated.template_key,
        is_active: updated.is_active,
        is_default: updated.is_default,
        primary_color: grapesConfig.theme?.primary_color ?? '#111111',
        accent_color: grapesConfig.theme?.accent_color ?? '#ea938c',
        heading_font_family: grapesConfig.theme?.heading_font_family ?? 'Cormorant Garamond',
        body_font_family: grapesConfig.theme?.body_font_family ?? 'Source Sans 3',
        show_terms_section: grapesConfig.settings?.show_terms_section ?? updated.show_terms_section,
        show_privacy_section:
          grapesConfig.settings?.show_privacy_section ?? updated.show_privacy_section,
        show_signature_section:
          grapesConfig.settings?.show_signature_section ?? updated.show_signature_section,
      });
      this.dirty.set(false);
      this.toast.showToast('Template published from Studio SDK.', 'success');
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] saveTemplate error:', error);
      this.toast.showToast('We were unable to publish this template right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async openTemplateList(): Promise<void> {
    await this.router.navigate(['/admin/proposal-templates']);
  }

  async reload(): Promise<void> {
    const templateId = this.route.snapshot.paramMap.get('templateId');
    if (!templateId) return;
    await this.loadTemplate(templateId);
  }

  private async loadTemplate(templateId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const template = await this.templateRepository.getDocumentTemplateById(templateId);
      if (!template) {
        this.error.set('We could not find this proposal template.');
        return;
      }

      this.template.set(template);
      const storedConfig = this.templateStudio.getStoredConfig(template);
      this.lastDraftSavedAt.set(null);
      this.form.set({
        name: template.name,
        template_key: template.template_key,
        is_active: template.is_active,
        is_default: template.is_default,
        primary_color: storedConfig?.theme?.primary_color ?? '#111111',
        accent_color: storedConfig?.theme?.accent_color ?? '#ea938c',
        heading_font_family: storedConfig?.theme?.heading_font_family ?? 'Cormorant Garamond',
        body_font_family: storedConfig?.theme?.body_font_family ?? 'Source Sans 3',
        show_terms_section: storedConfig?.settings?.show_terms_section ?? template.show_terms_section,
        show_privacy_section:
          storedConfig?.settings?.show_privacy_section ?? template.show_privacy_section,
        show_signature_section:
          storedConfig?.settings?.show_signature_section ?? template.show_signature_section,
      });

      if (!isPlatformBrowser(this.platformId)) {
        this.ready.set(false);
        return;
      }

      this.loading.set(false);
      await this.waitForEditorHost();
      await this.initializeEditor(template);
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] loadTemplate error:', error);
      this.error.set('We were unable to load the Studio SDK proposal editor right now.');
    } finally {
      if (this.loading()) {
        this.loading.set(false);
      }
    }
  }

  private async initializeEditor(template: DocumentTemplate): Promise<void> {
    if (!this.editorHost) return;

    if (!this.createStudioEditor) {
      const module = await import('@grapesjs/studio-sdk');
      this.createStudioEditor = (module.createStudioEditor ??
        module.default) as unknown as (options: CreateEditorOptions) => Promise<void>;
    }

    this.destroyEditor();
    this.editorHost.nativeElement.replaceChildren();
    this.ready.set(false);

    const defaultProject = this.templateStudio.buildDefaultProject(template);

    await this.createStudioEditor({
      root: this.editorHost.nativeElement,
      autoHeight: true,
      licenseKey: this.getStudioLicenseKey(),
      localStorage: 'black-begonia-studio-sdk',
      theme: this.getStudioTheme(),
      project: {
        id: template.template_id,
        type: 'document',
        default: defaultProject,
      },
      pages: false,
      settingsMenu: {
        about: false,
        embed: false,
        installApp: false,
        loadProject: false,
        openProject: false,
        saveProject: false,
        theme: false,
      },
      storage: {
        type: 'self',
        autosaveChanges: 10,
        autosaveIntervalMs: 5000,
        onLoad: async () => ({
          project: this.getProjectData(defaultProject),
        }),
        onSave: async ({ project }: { project: ProjectData }) => {
          await this.persistDraftProject(project);
        },
      },
      onEditor: (editor: Editor) => {
        this.editorRef.set(editor);
        this.templateStudio.registerEditor(editor);
      },
      onReady: () => {
        this.ready.set(true);
        this.dirty.set(false);
      },
      onUpdate: () => {
        this.dirty.set(true);
      },
      onDestroy: () => {
        this.editorRef.set(null);
        this.ready.set(false);
      },
    });
  }

  private async persistDraftProject(project: ProjectData): Promise<void> {
    const template = this.template();
    if (!template) return;

    const payload = this.form();

    try {
      this.autosaving.set(true);
      const draftConfig = this.templateStudio.buildDraftConfig(project, this.getStoredConfig());
      draftConfig.theme = {
        primary_color: payload.primary_color,
        accent_color: payload.accent_color,
        heading_font_family: payload.heading_font_family,
        body_font_family: payload.body_font_family,
      };
      draftConfig.settings = {
        show_terms_section: payload.show_terms_section,
        show_privacy_section: payload.show_privacy_section,
        show_signature_section: payload.show_signature_section,
      };

      const updated = await this.templateService.updateDocumentTemplate(template.template_id, {
        template_config: this.templateStudio.buildTemplateConfig(template, draftConfig),
      });

      this.template.set(updated);
      this.lastDraftSavedAt.set(new Date().toISOString());
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] persistDraftProject error:', error);
      throw error;
    } finally {
      this.autosaving.set(false);
    }
  }

  private getProjectData(defaultProject: ProjectData): ProjectData {
    return (this.getStoredConfig()?.project_data as ProjectData | undefined) ?? defaultProject;
  }

  private async waitForEditorHost(): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (this.editorHost?.nativeElement) {
        return;
      }

      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    }
  }

  private destroyEditor(): void {
    const editor = this.editorRef();

    if (editor) {
      editor.destroy();
      this.editorRef.set(null);
    }
  }

  private getStudioLicenseKey(): string {
    const key = environment.grapesjsStudioLicenseKey?.trim();
    return !key || key === 'undefined' || key === 'default' ? 'DEV_LICENSE_KEY' : key;
  }

  private getStudioTheme(): 'light' | 'dark' {
    return this.crmThemeService.mode() === 'dark' ? 'dark' : 'light';
  }

  private getStoredConfig(): GrapesJsStoredTemplateConfig | null {
    return this.templateStudio.getStoredConfig(this.template());
  }
}
