import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

import {
  DocumentTemplate,
  FloralProposalRenderContract,
  FloralProposalRenderLineItem,
} from '../../../../core/models/floral-proposal';
import { Lead } from '../../../../core/models/lead';
import { ToastService } from '../../../../core/services/toast.service';
import { DocumentTemplateRepositoryService } from '../../../../core/supabase/repositories/document-template-repository.service';
import { DocumentTemplateService } from '../../../../core/supabase/services/document-template.service';
import { FloralProposalWorkflowService } from '../../../../core/supabase/services/floral-proposal-workflow.service';
import { DocumentTemplateStudioBridgeService } from '../../../../core/templates/document-template-studio-bridge.service';
import { TEMPLATE_BLOCK_REGISTRY } from '../../../../core/templates/template-block-registry';
import { TemplateDocumentRendererService } from '../../../../core/templates/template-document-renderer.service';
import { TemplateVersioningService } from '../../../../core/templates/template-versioning.service';
import {
  TemplateBlock,
  TemplateDefinition,
  TemplatePreviewProfile,
  ValidationIssue,
  StoredTemplateStudioPublishedVersion,
} from '../../../../core/templates/template-studio.models';
import { TemplateStudioStore } from '../../../../core/templates/template-studio.store';
import { EntityDetailShellComponent } from '../../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { ErrorStateBlockComponent } from '../../../../shared/components/private/error-state-block/error-state-block.component';
import { LoadingStateBlockComponent } from '../../../../shared/components/private/loading-state-block/loading-state-block.component';

@Component({
  selector: 'app-proposal-template-studio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EntityDetailShellComponent,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
  ],
  templateUrl: './proposal-template-studio.component.html',
})
export class ProposalTemplateStudioComponent implements OnInit {
  readonly blockRegistry = TEMPLATE_BLOCK_REGISTRY;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly documentTemplateRepository = inject(DocumentTemplateRepositoryService);
  private readonly documentTemplateService = inject(DocumentTemplateService);
  private readonly floralProposalWorkflow = inject(FloralProposalWorkflowService);
  private readonly documentTemplateStudioBridge = inject(DocumentTemplateStudioBridgeService);
  private readonly templateDocumentRenderer = inject(TemplateDocumentRendererService);
  private readonly templateVersioningService = inject(TemplateVersioningService);
  readonly templateStudioStore = inject(TemplateStudioStore);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly template = signal<DocumentTemplate | null>(null);
  readonly previewPdfObjectUrl = signal<string | null>(null);
  readonly previewPdfLoading = signal(false);
  readonly previewPdfError = signal<string | null>(null);
  readonly previewLastRenderedAt = signal<string | null>(null);
  readonly templateStudioErrors = signal<ValidationIssue[]>([]);
  readonly templateStudioWarnings = signal<ValidationIssue[]>([]);
  readonly publishedVersions = signal<StoredTemplateStudioPublishedVersion[]>([]);
  readonly selectedBlockSectionState = signal<Record<string, boolean>>({});
  readonly studioPanelState = signal<Record<string, boolean>>({
    selectedBlockControls: true,
    themeTokens: true,
    advancedCss: false,
    publishWorkflow: false,
    assetLibrary: false,
  });
  private previewRequestVersion = 0;
  private previewDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  private previewRequestInFlight = false;
  private queuedPreviewRequest:
    | { draft: TemplateDefinition; proposal: TemplatePreviewProfile['proposal_render_model'] }
    | null = null;

  readonly templatePreviewProfiles = signal<TemplatePreviewProfile[]>([
    {
      id: 'wedding-editorial',
      label: 'Wedding Editorial',
      proposal_render_model: {
        schema_version: '1.0',
        proposal: {
          id: 'sample-proposal',
          number: 'FP-2026-001',
          title: 'Spring Garden Wedding Proposal',
          status: 'previewed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          valid_until: null,
          currency: 'USD',
        },
        branding: {
          business_name: 'Black Begonia Floral',
          logo_url: null,
          website: 'https://blackbegonia.example',
          email: 'studio@blackbegonia.example',
          phone: '(555) 100-2000',
          instagram: '@blackbegoniafloral',
          address_lines: ['Portland, Oregon'],
        },
        client: {
          primary_contact: {
            first_name: 'Avery',
            last_name: 'Hart',
            full_name: 'Avery Hart',
            email: 'avery@example.com',
            phone: '(555) 222-3344',
          },
          partner_contact: {
            full_name: 'Jordan Hart',
          },
        },
        event: {
          type: 'Wedding',
          date: new Date().toISOString(),
          venue_name: 'The Conservatory',
          venue_city: 'Portland',
          venue_state: 'OR',
          guest_count: 120,
          planner_name: 'Willow Events',
          planner_email: 'hello@willowevents.example',
          planner_phone: '(555) 444-5566',
        },
        intro: {
          greeting: 'Hello Avery,',
          welcome_message:
            'Thank you for inviting us into your celebration. This proposal reflects a lush garden-forward floral direction with layered spring texture.',
          closing_message:
            'We would be honored to bring this floral story to life for your day.',
          signature_name: 'Tristan Knott',
          signature_title: 'Creative Director',
        },
        gallery: {
          hero_image_url: null,
          mood_images: [
            { id: 'm1', url: 'https://example.com/mood-1.jpg', caption: 'Ceremony palette' },
            { id: 'm2', url: 'https://example.com/mood-2.jpg', caption: 'Reception mood' },
          ],
        },
        line_items: [
          {
            id: 'li-1',
            name: 'Bridal Bouquet',
            category: 'Personal Flowers',
            description: 'Garden rose bouquet with reflexed blooms and silk ribbon wrap.',
            quantity: 1,
            unit_label: 'arrangement',
            image_url: null,
            notes: null,
            pricing: {
              unit_price: 325,
              line_total: 325,
              price_visible: true,
            },
          },
          {
            id: 'li-2',
            name: 'Reception Centerpieces',
            category: 'Reception',
            description: 'Compote centerpieces with layered local florals and taper candles.',
            quantity: 12,
            unit_label: 'tables',
            image_url: null,
            notes: null,
            pricing: {
              unit_price: 165,
              line_total: 1980,
              price_visible: true,
            },
          },
        ],
        inclusions: [
          { id: 'inc-1', label: 'Delivery and on-site setup' },
          { id: 'inc-2', label: 'Breakdown of personal flowers packaging' },
        ],
        investment: {
          subtotal: 2305,
          tax_total: 184.4,
          service_fee_total: 150,
          grand_total: 2639.4,
          deposit_amount: 750,
          payment_schedule: [
            { label: 'Retainer', amount: 750, due_date: new Date().toISOString() },
            { label: 'Final Balance', amount: 1889.4, due_date: new Date().toISOString() },
          ],
        },
        terms: {
          payment_terms: 'A signed agreement and retainer are required to reserve your date.',
          cancellation_policy: 'Retainers are non-refundable once the date is reserved.',
          revision_policy: 'One major revision round is included prior to final sign-off.',
          notes: null,
        },
        cta: {
          acceptance_label: 'Approve Proposal',
          acceptance_instructions: 'Reply to this proposal or sign digitally to move forward.',
          proposal_access_url: null,
        },
        meta: {
          generated_at: new Date().toISOString(),
          sample_data: true,
        },
      },
    },
    {
      id: 'concise-event',
      label: 'Concise Event',
      proposal_render_model: {
        schema_version: '1.0',
        proposal: {
          id: 'sample-proposal-2',
          number: 'FP-2026-002',
          title: 'Private Dinner Floral Proposal',
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          valid_until: null,
          currency: 'USD',
        },
        branding: {
          business_name: 'Black Begonia Floral',
          logo_url: null,
          email: 'studio@blackbegonia.example',
          phone: '(555) 100-2000',
        },
        client: {
          primary_contact: {
            first_name: 'Mila',
            last_name: 'Stone',
            full_name: 'Mila Stone',
            email: 'mila@example.com',
          },
        },
        event: {
          type: 'Private Dinner',
          date: new Date().toISOString(),
          venue_name: 'The Foundry Loft',
          venue_city: 'Seattle',
          venue_state: 'WA',
          guest_count: 24,
        },
        intro: {
          greeting: 'Hello Mila,',
          welcome_message: 'An intimate floral direction centered on candlelit tables, fruitwood vessels, and layered neutrals.',
          closing_message: 'We would love to shape this dinner experience with you.',
          signature_name: 'Tristan Knott',
          signature_title: 'Creative Director',
        },
        gallery: {
          hero_image_url: null,
          mood_images: [],
        },
        line_items: [
          {
            id: 'li-a',
            name: 'Statement Entrance Arrangement',
            category: 'Installations',
            description: 'A sculptural asymmetrical entrance piece with branching texture.',
            quantity: 1,
            unit_label: 'arrangement',
            image_url: null,
            notes: null,
            pricing: {
              unit_price: 480,
              line_total: 480,
              price_visible: true,
            },
          },
        ],
        inclusions: [{ id: 'inc-a', label: 'Delivery and placement' }],
        investment: {
          subtotal: 480,
          tax_total: 38.4,
          service_fee_total: 40,
          grand_total: 558.4,
        },
        terms: {
          payment_terms: 'A 50% retainer secures the date.',
          cancellation_policy: 'Cancellations within 14 days are non-refundable.',
          revision_policy: 'One round of refinement is included.',
          notes: null,
        },
        cta: {
          acceptance_label: 'Approve Proposal',
          acceptance_instructions: 'Reply with approval and we will issue the invoice.',
          proposal_access_url: null,
        },
        meta: {
          generated_at: new Date().toISOString(),
          sample_data: true,
        },
      },
    },
  ]);

  readonly studioDraft = computed(() => this.templateStudioStore.workingDraft());
  readonly selectedStudioBlock = computed(() => this.templateStudioStore.selectedBlock());
  readonly selectedStudioBlockControlGroups = computed(() => {
    const block = this.selectedStudioBlock();
    if (!block) return [];
    return this.blockRegistry[block.type].controls ?? [];
  });
  readonly templateBlockSummaries = computed(() =>
    this.studioDraft()
      ?.blocks
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((block) => ({
        ...block,
        label: this.blockRegistry[block.type].label,
        variantLabel: this.formatLabel(block.layout_variant),
      })) ?? []
  );
  readonly previewRenderStatus = computed(() => this.templateStudioStore.snapshot().preview.render_status);
  readonly previewPdfUrl = computed<SafeResourceUrl | null>(() => {
    const objectUrl = this.previewPdfObjectUrl();
    return objectUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl) : null;
  });
  readonly activePreviewProfile = computed(
    () =>
      this.templatePreviewProfiles().find(
        (profile) => profile.id === this.templateStudioStore.snapshot().preview.sample_data_profile_id
      ) ?? this.templatePreviewProfiles()[0] ?? null
  );
  readonly activePreviewProfileLabel = computed(() => this.activePreviewProfile()?.label ?? 'None');
  readonly previewLastRenderedLabel = computed(() => {
    const value = this.previewLastRenderedAt();
    if (!value) return 'Not rendered yet';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  });
  readonly enabledTemplateBlockCount = computed(
    () => this.templateBlockSummaries().filter((block) => block.enabled).length
  );
  readonly previewZoom = computed(() => this.templateStudioStore.snapshot().preview.zoom);
  readonly previewDeviceMode = computed(() => this.templateStudioStore.snapshot().preview.device_mode);
  readonly draftAssets = computed(() => this.studioDraft()?.assets ?? []);
  readonly publishNotes = computed(() => this.templateStudioStore.snapshot().publish.publish_notes ?? '');
  readonly lastPublishedVersion = computed(
    () => this.templateStudioStore.snapshot().publish.last_published_version ?? null
  );

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const templateId = params.get('templateId');
      if (!templateId) {
        this.error.set('We could not find a template to open in Template Studio.');
        this.loading.set(false);
        return;
      }

      void this.loadTemplate(templateId);
    });
  }

  async saveTemplateStudioDraft(): Promise<void> {
    const template = this.template();
    const draft = this.studioDraft();
    const previewProfile = this.activePreviewProfile();
    if (!template || !draft || this.saving()) return;

    const validation = this.documentTemplateStudioBridge.validateTemplateDefinition(
      draft,
      previewProfile?.proposal_render_model
    );
    this.templateStudioErrors.set(validation.errors);
    this.templateStudioWarnings.set(validation.warnings);
    this.templateStudioStore.updateValidation(validation.errors, validation.warnings);

    if (validation.errors.length > 0) {
      this.toast.showToast('Template Studio has validation errors. Please resolve them before saving.', 'error');
      return;
    }

    try {
      this.saving.set(true);
      const updatedTemplate = await this.documentTemplateService.updateTemplateStudioDocumentTemplate(
        template,
        draft
      );
      this.template.set(updatedTemplate);
      this.templateStudioStore.markSaved(draft);
      this.toast.showToast('Template Studio draft saved.', 'success');
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] saveTemplateStudioDraft error:', error);
      this.toast.showToast('We were unable to save the Template Studio draft right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async publishTemplateStudioVersion(): Promise<void> {
    const template = this.template();
    const draft = this.studioDraft();
    const previewProfile = this.activePreviewProfile();
    if (!template || !draft || this.saving()) return;

    const publishValidation = this.documentTemplateStudioBridge.validateTemplateDefinition(
      draft,
      previewProfile?.proposal_render_model,
      true
    );

    this.templateStudioErrors.set(publishValidation.errors);
    this.templateStudioWarnings.set(publishValidation.warnings);
    this.templateStudioStore.updateValidation(
      publishValidation.errors,
      publishValidation.warnings
    );

    if (publishValidation.errors.length > 0) {
      this.toast.showToast(
        'This draft needs a few fixes before we publish a version.',
        'error'
      );
      return;
    }

    const publishedSnapshot = this.templateVersioningService.createPublishedSnapshot(draft, {
      basedOnTemplateId: draft.id,
      basedOnVersion: this.lastPublishedVersion() ?? draft.version,
    });
    const nextDraft = this.templateVersioningService.createDerivedDraft(publishedSnapshot);
    const nextPublishedVersions = [
      ...this.publishedVersions(),
      {
        version: publishedSnapshot.version,
        published_at: publishedSnapshot.metadata.published_at ?? new Date().toISOString(),
        notes: this.publishNotes().trim() || null,
        definition: publishedSnapshot,
      },
    ].sort((left, right) => right.version - left.version);

    try {
      this.saving.set(true);
      const updatedTemplate = await this.documentTemplateService.updateTemplateStudioDocumentTemplate(
        template,
        nextDraft,
        {},
        {
          last_published_version: publishedSnapshot.version,
          published_versions: nextPublishedVersions,
        }
      );
      this.template.set(updatedTemplate);
      this.publishedVersions.set(nextPublishedVersions);
      this.templateStudioStore.markPublished(nextDraft, publishedSnapshot.version);
      this.toast.showToast(
        `Published Template Studio version ${publishedSnapshot.version}.`,
        'success'
      );
      this.refreshStudioValidationAndPreview();
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] publishTemplateStudioVersion error:', error);
      this.toast.showToast(
        'We were unable to publish this Template Studio version right now.',
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }

  updatePublishNotes(value: string): void {
    this.templateStudioStore.setPublishNotes(value);
  }

  async restorePublishedVersion(version: StoredTemplateStudioPublishedVersion): Promise<void> {
    const template = this.template();
    if (!template || this.saving()) return;

    const restoredDraft = this.templateVersioningService.createDerivedDraft(version.definition);

    try {
      this.saving.set(true);
      const updatedTemplate = await this.documentTemplateService.updateTemplateStudioDocumentTemplate(
        template,
        restoredDraft,
        {},
        {
          last_published_version: this.lastPublishedVersion(),
          published_versions: this.publishedVersions(),
        }
      );

      this.template.set(updatedTemplate);
      this.templateStudioStore.markSaved(restoredDraft);
      this.templateStudioStore.selectBlock(restoredDraft.blocks[0]?.id ?? null);
      this.refreshStudioValidationAndPreview();
      this.toast.showToast(
        `Restored version ${version.version} into the active draft.`,
        'success'
      );
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] restorePublishedVersion error:', error);
      this.toast.showToast(
        'We were unable to restore that published version right now.',
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }

  selectStudioBlock(blockId: string): void {
    this.templateStudioStore.selectBlock(blockId);
    this.initializeSelectedBlockSections(blockId);
  }

  addBlock(blockType: string): void {
    const draft = this.studioDraft();
    if (!draft) return;
    if (!(blockType in this.blockRegistry)) return;

    const registryItem = this.blockRegistry[blockType as keyof typeof TEMPLATE_BLOCK_REGISTRY];
    const block = {
      id: `${blockType}-${Date.now()}`,
      type: blockType as keyof typeof TEMPLATE_BLOCK_REGISTRY,
      enabled: true,
      order: draft.blocks.length + 1,
      layout_variant: registryItem.defaults.layout_variant,
      content: structuredClone(registryItem.defaults.content),
      styles: structuredClone(registryItem.defaults.styles),
    } as TemplateBlock;

    this.templateStudioStore.addBlock(block);
    this.initializeSelectedBlockSections(block.id, true);
    this.refreshStudioValidationAndPreview();
  }

  duplicateSelectedBlock(): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    const duplicate = structuredClone(block) as TemplateBlock;
    duplicate.id = `${block.type}-${Date.now()}`;
    this.templateStudioStore.duplicateBlock(block.id, duplicate);
    this.initializeSelectedBlockSections(duplicate.id, true);
    this.refreshStudioValidationAndPreview();
  }

  removeSelectedBlock(): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    this.templateStudioStore.removeBlock(block.id);
    this.refreshStudioValidationAndPreview();
  }

  moveSelectedBlock(direction: 'up' | 'down'): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    this.templateStudioStore.moveBlock(block.id, direction);
    this.refreshStudioValidationAndPreview();
  }

  updateSelectedBlockEnabled(enabled: boolean): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    this.templateStudioStore.updateBlock(block.id, 'enabled', enabled);
    this.refreshStudioValidationAndPreview();
  }

  updateSelectedBlockVariant(variant: string): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    this.templateStudioStore.updateBlock(block.id, 'layout_variant', variant as TemplateBlock['layout_variant']);
    this.refreshStudioValidationAndPreview();
  }

  updateSelectedBlockContent(key: string, value: string | boolean | number | null): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    this.templateStudioStore.updateBlockNestedValue(block.id, 'content', key, value);
    this.refreshStudioValidationAndPreview();
  }

  updateSelectedBlockStyle(key: string, value: string | number | null): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    this.templateStudioStore.updateBlockNestedValue(block.id, 'styles', key, value);
    this.refreshStudioValidationAndPreview();
  }

  resetSelectedBlockStyles(): void {
    const block = this.selectedStudioBlock();
    if (!block) return;

    const defaults = this.blockRegistry[block.type].defaults.styles ?? {};
    this.templateStudioStore.replaceBlockStyles(block.id, structuredClone(defaults));
    this.refreshStudioValidationAndPreview();
    this.toast.showToast("Block styles reset to this variant's defaults.", 'success');
  }

  updateSelectedBlockVisibility(
    key: 'event_types' | 'requires_data_paths',
    value: string
  ): void {
    const block = this.selectedStudioBlock();
    const draft = this.studioDraft();
    if (!block || !draft) return;

    const parsedValues = value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const nextDraft: TemplateDefinition = {
      ...draft,
      blocks: draft.blocks.map((draftBlock) =>
        draftBlock.id === block.id
          ? {
              ...draftBlock,
              visibility: {
                ...(draftBlock.visibility ?? {}),
                [key]: parsedValues,
              },
            }
          : draftBlock
      ),
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    };

    this.templateStudioStore.replaceWorkingDraft(nextDraft);
    this.refreshStudioValidationAndPreview();
  }

  updateThemeColor(
    key: 'primary' | 'accent' | 'canvas' | 'surface' | 'text' | 'muted_text' | 'border',
    value: string
  ): void {
    this.templateStudioStore.updateTokenNestedValue('colors', key, value);
    this.refreshStudioValidationAndPreview();
  }

  updateThemeFont(key: 'heading_font_family' | 'body_font_family', value: string): void {
    const draft = this.studioDraft();
    if (!draft) return;
    this.templateStudioStore.replaceWorkingDraft({
      ...draft,
      tokens: {
        ...draft.tokens,
        typography: {
          ...draft.tokens.typography,
          [key]: value,
        },
      },
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    });
    this.refreshStudioValidationAndPreview();
  }

  updateThemeTypographyScale(
    section: 'sizes' | 'weights',
    key: string,
    value: number
  ): void {
    this.templateStudioStore.updateTypographyNestedValue(section, key, value);
    this.refreshStudioValidationAndPreview();
  }

  getThemeColorValue(
    key: 'primary' | 'accent' | 'canvas' | 'surface' | 'text' | 'muted_text' | 'border'
  ): string {
    return this.studioDraft()?.tokens.colors[key] ?? '#000000';
  }

  getThemeTypographyValue(
    section: 'sizes' | 'weights',
    key: string
  ): number {
    const typographySection = this.studioDraft()?.tokens.typography[section];
    if (!typographySection || typeof typographySection !== 'object') {
      return 0;
    }

    const value = (typographySection as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : 0;
  }

  updateAdvancedCss(value: string): void {
    this.templateStudioStore.updateAdvancedCss(value);
    this.refreshStudioValidationAndPreview();
  }

  async uploadTemplateAsset(event: Event, assetType: 'logo' | 'background' | 'texture' | 'image'): Promise<void> {
    const template = this.template();
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!template || !file) {
      if (input) input.value = '';
      return;
    }

    try {
      this.saving.set(true);
      const asset = await this.documentTemplateService.uploadTemplateAsset(
        template.template_id,
        file,
        assetType
      );
      this.templateStudioStore.upsertAsset(asset);
      this.refreshStudioValidationAndPreview();
      this.toast.showToast('Template asset uploaded.', 'success');
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] uploadTemplateAsset error:', error);
      this.toast.showToast('We were unable to upload the template asset right now.', 'error');
    } finally {
      if (input) input.value = '';
      this.saving.set(false);
    }
  }

  async removeTemplateAsset(assetId: string): Promise<void> {
    const asset = this.draftAssets().find((item) => item.id === assetId);
    if (!asset) return;

    try {
      this.saving.set(true);
      if (asset.storage_path) {
        await this.documentTemplateService.removeTemplateAsset(asset.storage_path);
      }
      this.templateStudioStore.removeAsset(assetId);
      this.refreshStudioValidationAndPreview();
      this.toast.showToast('Template asset removed.', 'success');
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] removeTemplateAsset error:', error);
      this.toast.showToast('We were unable to remove the template asset right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  setPreviewProfile(profileId: string): void {
    this.templateStudioStore.setPreviewProfile(profileId);
    void this.refreshStudioValidationAndPreview();
  }

  refreshPdfPreview(): void {
    void this.refreshStudioValidationAndPreview(true);
  }

  setPreviewDeviceMode(mode: 'page' | 'desktop' | 'mobile'): void {
    this.templateStudioStore.setPreviewDeviceMode(mode);
  }

  setPreviewZoom(value: number): void {
    this.templateStudioStore.setPreviewZoom(Number(value));
  }

  getBlockControlValue(controlKey: string): string | number | boolean | null {
    const block = this.selectedStudioBlock();
    if (!block) return null;

    const path = controlKey.split('.');
    if (path[0] === 'content') {
      return (block.content as Record<string, unknown>)[path[1]] as string | number | boolean | null;
    }
    if (path[0] === 'styles') {
      return ((block.styles ?? {}) as Record<string, unknown>)[path[1]] as string | number | boolean | null;
    }
    return null;
  }

  getSelectControlOptions(control: unknown): Array<{ label: string; value: string }> {
    if (!control || typeof control !== 'object' || !('options' in control)) {
      return [];
    }

    return (control as { options?: Array<{ label: string; value: string }> }).options ?? [];
  }

  getAssetControlOptions(control: unknown): Array<{ label: string; value: string }> {
    if (!control || typeof control !== 'object' || !('asset_types' in control)) {
      return [];
    }

    const assetTypes = (control as { asset_types?: Array<'logo' | 'background' | 'texture' | 'image'> }).asset_types ?? [];
    return this.draftAssets()
      .filter((asset) => assetTypes.includes(asset.type))
      .map((asset) => ({
        label: `${this.formatLabel(asset.type)} | ${asset.alt || asset.id}`,
        value: asset.id,
      }));
  }

  getRangeControlMin(control: unknown): number {
    if (!control || typeof control !== 'object' || !('min' in control)) {
      return 0;
    }

    const value = (control as { min?: number }).min;
    return typeof value === 'number' ? value : 0;
  }

  getRangeControlMax(control: unknown): number {
    if (!control || typeof control !== 'object' || !('max' in control)) {
      return 100;
    }

    const value = (control as { max?: number }).max;
    return typeof value === 'number' ? value : 100;
  }

  getRangeControlStep(control: unknown): number {
    if (!control || typeof control !== 'object' || !('step' in control)) {
      return 1;
    }

    const value = (control as { step?: number }).step;
    return typeof value === 'number' ? value : 1;
  }

  getValidationIssuesForBlock(blockId: string): ValidationIssue[] {
    return [...this.templateStudioErrors(), ...this.templateStudioWarnings()].filter(
      (issue) => issue.block_id === blockId
    );
  }

  getSelectedBlockVisibilityValue(key: 'event_types' | 'requires_data_paths'): string {
    return (this.selectedStudioBlock()?.visibility?.[key] ?? []).join(', ');
  }

  isSelectedBlockSectionExpanded(sectionId: string): boolean {
    const block = this.selectedStudioBlock();
    if (!block) return false;

    const key = this.getSelectedBlockSectionKey(block.id, sectionId);
    const state = this.selectedBlockSectionState();
    return state[key] ?? false;
  }

  toggleSelectedBlockSection(sectionId: string): void {
    const block = this.selectedStudioBlock();
    if (!block) return;

    const key = this.getSelectedBlockSectionKey(block.id, sectionId);
    this.selectedBlockSectionState.update((state) => ({
      ...state,
      [key]: !(state[key] ?? false),
    }));
  }

  isStudioPanelExpanded(
    panelId: 'selectedBlockControls' | 'themeTokens' | 'advancedCss' | 'publishWorkflow' | 'assetLibrary'
  ): boolean {
    return this.studioPanelState()[panelId] ?? false;
  }

  toggleStudioPanel(
    panelId: 'selectedBlockControls' | 'themeTokens' | 'advancedCss' | 'publishWorkflow' | 'assetLibrary'
  ): void {
    this.studioPanelState.update((state) => ({
      ...state,
      [panelId]: !(state[panelId] ?? false),
    }));
  }

  formatLabel(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  controlTrackBy(index: number, _item?: unknown): number {
    return index;
  }

  retry(): void {
    const templateId = this.route.snapshot.paramMap.get('templateId');
    if (templateId) {
      void this.loadTemplate(templateId);
    }
  }

  goBack(): void {
    const template = this.template();
    if (template) {
      void this.router.navigate(['/admin/proposal-templates', template.template_id]);
      return;
    }

    void this.router.navigate(['/admin/proposal-templates']);
  }

  private async loadTemplate(templateId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const template = await this.documentTemplateRepository.getDocumentTemplateById(templateId);
      if (!template) {
        this.error.set('We could not find this proposal template.');
        this.loading.set(false);
        return;
      }

      this.template.set(template);
      const definition = this.documentTemplateStudioBridge.getTemplateDefinition(template);
      const storedStudioConfig = this.documentTemplateStudioBridge.getStoredTemplateStudioConfig(template);
      const publishedVersions = storedStudioConfig?.published_versions ?? [];
      const validation = this.documentTemplateStudioBridge.validateTemplateDefinition(definition);

      this.publishedVersions.set(publishedVersions);
      this.templateStudioErrors.set(validation.errors);
      this.templateStudioWarnings.set(validation.warnings);
      this.templateStudioStore.initializeDraft(definition, {
        mode: 'edit',
        sampleProfile: this.templatePreviewProfiles()[0] ?? null,
        lastPublishedVersion: storedStudioConfig?.last_published_version ?? null,
      });
      this.templateStudioStore.updateValidation(validation.errors, validation.warnings);
      this.initializeSelectedBlockSections(definition.blocks[0]?.id ?? null, true);
      void this.refreshStudioValidationAndPreview(true);
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] loadTemplate error:', error);
      this.error.set('We were unable to load this Template Studio workspace right now.');
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshStudioValidationAndPreview(immediate = false): Promise<void> {
    const draft = this.studioDraft();
    if (!draft) return;
    const profile = this.activePreviewProfile();

    const validation = this.documentTemplateStudioBridge.validateTemplateDefinition(
      draft,
      profile?.proposal_render_model
    );
    this.templateStudioErrors.set(validation.errors);
    this.templateStudioWarnings.set(validation.warnings);
    this.templateStudioStore.updateValidation(validation.errors, validation.warnings);

    if (!profile) {
      this.templateStudioStore.updateRenderStatus('idle', []);
      return;
    }

    const preview = this.templateDocumentRenderer.render({
      template: draft,
      proposal: profile.proposal_render_model,
      mode: 'preview',
    });

    this.templateStudioStore.updateRenderStatus(
      validation.errors.length === 0 ? 'ready' : 'error',
      [...validation.warnings.map((issue) => issue.message), ...preview.warnings],
      preview.html
    );

    if (validation.errors.length > 0) {
      this.previewPdfLoading.set(false);
      this.previewPdfError.set('Resolve validation errors before generating the PDF preview.');
      this.resetPreviewPdfUrl(null);
      return;
    }

    if (this.previewDebounceHandle) {
      clearTimeout(this.previewDebounceHandle);
      this.previewDebounceHandle = null;
    }

    if (immediate) {
      await this.generatePdfPreview(draft, profile.proposal_render_model);
      return;
    }

    this.previewDebounceHandle = setTimeout(() => {
      void this.generatePdfPreview(draft, profile.proposal_render_model);
    }, 350);
  }

  private async generatePdfPreview(
    draft: TemplateDefinition,
    proposal: TemplatePreviewProfile['proposal_render_model']
  ): Promise<void> {
    const template = this.template();
    if (!template) return;

    if (this.previewRequestInFlight) {
      this.queuedPreviewRequest = {
        draft: structuredClone(draft),
        proposal: structuredClone(proposal),
      };
      return;
    }

    const requestVersion = ++this.previewRequestVersion;
    this.previewRequestInFlight = true;
    this.previewPdfLoading.set(true);
    this.previewPdfError.set(null);

    try {
      const renderContract = this.buildStudioRenderContract(template, draft, proposal);
      const previewLead: Lead = {
        lead_id: renderContract.lead.lead_id,
        service_type: renderContract.lead.service_type,
        event_type: renderContract.lead.event_type ?? null,
        first_name: renderContract.lead.first_name,
        last_name: renderContract.lead.last_name,
        partner_first_name: null,
        partner_last_name: null,
        email: renderContract.lead.email,
        phone: null,
        preferred_contact_method: null,
        event_date: renderContract.lead.event_date ?? null,
        ceremony_venue_name: proposal.event.venue_name ?? null,
        ceremony_venue_city: proposal.event.venue_city ?? null,
        ceremony_venue_state: proposal.event.venue_state ?? null,
        reception_venue_name: proposal.event.venue_name ?? null,
        reception_venue_city: proposal.event.venue_city ?? null,
        reception_venue_state: proposal.event.venue_state ?? null,
        budget_range: null,
        guest_count: null,
        inquiry_message: null,
        source: 'template_studio_preview',
        status: 'nurturing',
        assigned_user_id: null,
        decline_reason: null,
        converted_project_id: null,
        converted_primary_contact_id: null,
        converted_at: null,
        declined_at: null,
        last_contacted_at: null,
        created_at: renderContract.generated_at,
        updated_at: renderContract.generated_at,
        consultation_scheduled_at: null,
        consultation_completed_at: null,
        planner_name: proposal.event.planner_name ?? null,
        planner_phone: proposal.event.planner_phone ?? null,
        planner_email: proposal.event.planner_email ?? null,
      };
      const previewPayload = this.floralProposalWorkflow.buildSubmissionPayload({
        lead: previewLead,
        renderContract,
        termsVersion: 'v1',
        privacyPolicyVersion: 'v1',
      });

      const previewPdf = await this.floralProposalWorkflow.previewProposalPdf(previewPayload);
      if (requestVersion !== this.previewRequestVersion) {
        URL.revokeObjectURL(previewPdf.objectUrl);
        return;
      }

      this.resetPreviewPdfUrl(previewPdf.objectUrl);
      this.previewLastRenderedAt.set(new Date().toISOString());
      this.templateStudioStore.updateRenderStatus(
        'ready',
        this.templateStudioStore.snapshot().preview.warnings,
        this.templateStudioStore.snapshot().preview.last_rendered_html
      );
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] generatePdfPreview error:', error);
      if (requestVersion !== this.previewRequestVersion) {
        return;
      }

      this.previewPdfError.set('We could not generate the Gotenberg PDF preview right now.');
      this.resetPreviewPdfUrl(null);
      this.templateStudioStore.updateRenderStatus(
        'error',
        [
          ...this.templateStudioStore.snapshot().preview.warnings,
          'We could not generate the Gotenberg PDF preview right now.',
        ],
        this.templateStudioStore.snapshot().preview.last_rendered_html
      );
    } finally {
      this.previewRequestInFlight = false;
      if (requestVersion === this.previewRequestVersion) {
        this.previewPdfLoading.set(false);
      }

      const queued = this.queuedPreviewRequest;
      this.queuedPreviewRequest = null;
      if (queued) {
        void this.generatePdfPreview(queued.draft, queued.proposal);
      }
    }
  }

  private buildStudioRenderContract(
    template: DocumentTemplate,
    draft: TemplateDefinition,
    proposal: TemplatePreviewProfile['proposal_render_model']
  ): FloralProposalRenderContract {
    const lineItems: FloralProposalRenderLineItem[] = proposal.line_items.map((item, index) => ({
      display_order: index,
      line_item_type: 'product',
      line_type_label: item.category || 'Product',
      item_name: item.name,
      quantity: item.quantity ?? 1,
      unit_price: item.pricing.unit_price ?? item.pricing.line_total,
      subtotal: item.pricing.line_total,
      image_storage_path: null,
      image_signed_url: item.image_url ?? null,
      image_alt_text: item.name,
      image_caption: item.notes ?? null,
      components: [],
    }));

    const productsTotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = proposal.investment.tax_total ?? 0;
    const totalAmount = proposal.investment.grand_total;

    return {
      proposal_id: `studio-preview-${template.template_id}`,
      proposal_version: draft.version,
      generated_at: new Date().toISOString(),
      lead: {
        lead_id: `studio-preview-${template.template_id}`,
        first_name: proposal.client.primary_contact.first_name,
        last_name: proposal.client.primary_contact.last_name,
        email: proposal.client.primary_contact.email ?? proposal.branding.email ?? 'preview@example.com',
        service_type: proposal.event.type || 'Floral Proposal',
        event_type: proposal.event.type ?? null,
        event_date: proposal.event.date ?? null,
        status: 'nurturing',
      },
      template: {
        template_id: template.template_id,
        name: template.name,
        template_key: template.template_key,
        header_layout: template.header_layout,
        line_item_layout: template.line_item_layout,
        footer_layout: template.footer_layout,
        logo_url: template.logo_url ?? null,
        primary_color: draft.tokens.colors.primary,
        accent_color: draft.tokens.colors.accent,
        heading_font_family: draft.tokens.typography.heading_font_family,
        body_font_family: draft.tokens.typography.body_font_family,
        show_cover_page: template.show_cover_page,
        show_intro_message: template.show_intro_message,
        intro_title: template.intro_title ?? null,
        intro_body: template.intro_body ?? null,
        show_terms_section: template.show_terms_section,
        show_privacy_section: template.show_privacy_section,
        show_signature_section: template.show_signature_section,
        agreement_clauses: template.agreement_clauses,
        header_content: template.header_content,
        footer_content: template.footer_content,
        body_config: template.body_config,
        template_config: {
          ...(template.template_config ?? {}),
          template_studio: {
            source: 'studio',
            definition: draft,
            last_published_version: this.lastPublishedVersion(),
            published_versions: this.publishedVersions(),
          },
        },
      },
      tax_region: {
        tax_region_id: null,
        name: 'Preview Tax Region',
        tax_rate:
          productsTotal > 0 && taxAmount > 0 ? Number((taxAmount / productsTotal).toFixed(4)) : 0,
      },
      pricing: {
        default_markup_percent: 300,
        labor_percent: 0,
      },
      line_items: lineItems,
      shopping_list: [],
      totals: {
        products_total: productsTotal,
        labor_total: 0,
        fees_total: proposal.investment.service_fee_total ?? 0,
        discounts_total: proposal.investment.discount_total ?? 0,
        subtotal: proposal.investment.subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      },
      renderer_assets: {
        line_item_images: lineItems.map((item) => ({
          display_order: item.display_order,
          item_name: item.item_name,
          storage_path: item.image_storage_path ?? null,
          signed_url: item.image_signed_url ?? null,
          alt_text: item.image_alt_text ?? null,
          caption: item.image_caption ?? null,
        })),
      },
    };
  }

  private resetPreviewPdfUrl(nextUrl: string | null): void {
    const previousUrl = this.previewPdfObjectUrl();
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }
    this.previewPdfObjectUrl.set(nextUrl);
  }

  private initializeSelectedBlockSections(blockId: string | null, reset = false): void {
    if (!blockId) return;

    const draft = this.studioDraft();
    const block = draft?.blocks.find((item) => item.id === blockId);
    if (!block) return;

    const groups = this.blockRegistry[block.type].controls ?? [];
    const defaultState = groups.reduce<Record<string, boolean>>((state, group, index) => {
      state[this.getSelectedBlockSectionKey(blockId, group.id)] = index === 0;
      return state;
    }, {
      [this.getSelectedBlockSectionKey(blockId, 'visibility')]: false,
    });

    this.selectedBlockSectionState.update((state) => {
      if (reset) {
        return {
          ...state,
          ...defaultState,
        };
      }

      const nextState = { ...state };
      for (const [key, value] of Object.entries(defaultState)) {
        if (!(key in nextState)) {
          nextState[key] = value;
        }
      }
      return nextState;
    });
  }

  private getSelectedBlockSectionKey(blockId: string, sectionId: string): string {
    return `${blockId}:${sectionId}`;
  }
}
