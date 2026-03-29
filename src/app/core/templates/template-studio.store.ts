import { Injectable, computed, signal } from '@angular/core';

import {
  TemplateDefinition,
  TemplatePreviewProfile,
  TemplateStudioState,
  ValidationIssue,
} from './template-studio.models';

@Injectable({
  providedIn: 'root',
})
export class TemplateStudioStore {
  private readonly state = signal<TemplateStudioState>({
    template_id: null,
    mode: 'create',
    status: 'idle',
    persisted_draft: null,
    working_draft: null,
    selected_block_id: null,
    expanded_panel: 'structure',
    preview: {
      device_mode: 'page',
      zoom: 1,
      sample_data_profile_id: null,
      render_status: 'idle',
      last_rendered_html: null,
      warnings: [],
    },
    history: {
      can_undo: false,
      can_redo: false,
    },
    dirty: false,
    validation: {
      errors: [],
      warnings: [],
    },
    publish: {
      last_published_version: null,
      publish_notes: null,
    },
    ui: {
      left_panel_open: true,
      right_panel_open: true,
      preview_fullscreen: false,
    },
  });

  readonly snapshot = computed(() => this.state());
  readonly workingDraft = computed(() => this.state().working_draft);
  readonly selectedBlock = computed(() => {
    const draft = this.state().working_draft;
    const blockId = this.state().selected_block_id;
    return draft?.blocks.find((block) => block.id === blockId) ?? null;
  });
  readonly canPublish = computed(
    () =>
      this.state().validation.errors.length === 0 &&
      this.state().preview.render_status === 'ready' &&
      !!this.state().working_draft
  );

  initializeDraft(
    draft: TemplateDefinition,
    options: {
      mode?: 'create' | 'edit';
      selectedBlockId?: string | null;
      sampleProfile?: TemplatePreviewProfile | null;
      lastPublishedVersion?: number | null;
    } = {}
  ): void {
    this.state.set({
      ...this.state(),
      template_id: draft.id,
      mode: options.mode ?? 'edit',
      status: 'ready',
      persisted_draft: structuredClone(draft),
      working_draft: structuredClone(draft),
      selected_block_id: options.selectedBlockId ?? draft.blocks[0]?.id ?? null,
      preview: {
        ...this.state().preview,
        sample_data_profile_id: options.sampleProfile?.id ?? null,
      },
      publish: {
        publish_notes: null,
        last_published_version: options.lastPublishedVersion ?? null,
      },
      dirty: false,
    });
  }

  updateValidation(errors: ValidationIssue[], warnings: ValidationIssue[]): void {
    this.patchState({
      validation: { errors, warnings },
    });
  }

  updateRenderStatus(
    status: TemplateStudioState['preview']['render_status'],
    warnings: string[] = [],
    html: string | null = null
  ): void {
    this.patchState({
      preview: {
        ...this.state().preview,
        render_status: status,
        warnings,
        last_rendered_html: html,
      },
    });
  }

  selectBlock(blockId: string | null): void {
    this.patchState({ selected_block_id: blockId });
  }

  setPreviewProfile(profileId: string | null): void {
    this.patchState({
      preview: {
        ...this.state().preview,
        sample_data_profile_id: profileId,
      },
    });
  }

  setPreviewDeviceMode(mode: TemplateStudioState['preview']['device_mode']): void {
    this.patchState({
      preview: {
        ...this.state().preview,
        device_mode: mode,
      },
    });
  }

  setExpandedPanel(panel: TemplateStudioState['expanded_panel']): void {
    this.patchState({ expanded_panel: panel });
  }

  markSaved(nextDraft: TemplateDefinition): void {
    this.patchState({
      persisted_draft: structuredClone(nextDraft),
      working_draft: structuredClone(nextDraft),
      dirty: false,
      status: 'ready',
    });
  }

  setPublishNotes(notes: string | null): void {
    this.patchState({
      publish: {
        ...this.state().publish,
        publish_notes: notes,
      },
    });
  }

  markPublished(nextDraft: TemplateDefinition, version: number): void {
    this.patchState({
      persisted_draft: structuredClone(nextDraft),
      working_draft: structuredClone(nextDraft),
      dirty: false,
      status: 'ready',
      publish: {
        ...this.state().publish,
        last_published_version: version,
        publish_notes: null,
      },
    });
  }

  replaceWorkingDraft(nextDraft: TemplateDefinition): void {
    this.patchState({
      working_draft: structuredClone(nextDraft),
      status: 'ready',
    });
  }

  updateBlock<K extends keyof TemplateDefinition['blocks'][number]>(
    blockId: string,
    key: K,
    value: TemplateDefinition['blocks'][number][K]
  ): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    this.replaceWorkingDraft({
      ...draft,
      blocks: draft.blocks.map((block) =>
        block.id === blockId ? ({ ...block, [key]: value } as typeof block) : block
      ),
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    });
  }

  updateBlockNestedValue(
    blockId: string,
    section: 'content' | 'styles',
    key: string,
    value: unknown
  ): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    this.replaceWorkingDraft({
      ...draft,
      blocks: draft.blocks.map((block) => {
        if (block.id !== blockId) return block;
        const currentSection = (block[section] ?? {}) as Record<string, unknown>;
        return {
          ...block,
          [section]: {
            ...currentSection,
            [key]: value,
          },
        };
      }),
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    });
  }

  replaceBlockStyles(
    blockId: string,
    styles: NonNullable<TemplateDefinition['blocks'][number]['styles']>
  ): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    this.replaceWorkingDraft({
      ...draft,
      blocks: draft.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              styles: structuredClone(styles),
            }
          : block
      ),
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    });
  }

  updateTokenNestedValue(section: keyof TemplateDefinition['tokens'], key: string, value: unknown): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    const tokenSection = draft.tokens[section];
    if (!tokenSection || typeof tokenSection !== 'object') return;

    this.replaceWorkingDraft({
      ...draft,
      tokens: {
        ...draft.tokens,
        [section]: {
          ...(tokenSection as Record<string, unknown>),
          [key]: value,
        },
      },
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    });
  }

  updateTypographyNestedValue(
    section: keyof TemplateDefinition['tokens']['typography'],
    key: string,
    value: unknown
  ): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    const typographySection = draft.tokens.typography[section];
    if (!typographySection || typeof typographySection !== 'object') return;

    this.replaceWorkingDraft({
      ...draft,
      tokens: {
        ...draft.tokens,
        typography: {
          ...draft.tokens.typography,
          [section]: {
            ...(typographySection as Record<string, unknown>),
            [key]: value,
          },
        },
      },
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    });
  }

  updateAdvancedCss(css: string): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    this.replaceWorkingDraft({
      ...draft,
      advanced: {
        ...draft.advanced,
        custom_css: css,
      },
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    });
  }

  upsertAsset(asset: TemplateDefinition['assets'][number]): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    const existingIndex = draft.assets.findIndex((item) => item.id === asset.id);
    const nextAssets = draft.assets.slice();
    if (existingIndex >= 0) {
      nextAssets[existingIndex] = asset;
    } else {
      nextAssets.push(asset);
    }

    this.replaceWorkingDraft({
      ...draft,
      assets: nextAssets,
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    });
  }

  removeAsset(assetId: string): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    const nextBlocks = draft.blocks.map((block) => {
      const nextBlock =
        block.type === 'cover' && block.content.hero_asset_id === assetId
          ? {
              ...block,
              content: {
                ...block.content,
                hero_asset_id: null,
                hero_image_source: 'none' as const,
              },
            }
          : block;

      if (nextBlock.styles?.background_asset_id !== assetId) {
        return nextBlock;
      }

      return {
        ...nextBlock,
        styles: {
          ...nextBlock.styles,
          background_asset_id: null,
        },
      };
    });

    this.replaceWorkingDraft({
      ...draft,
      assets: draft.assets.filter((asset) => asset.id !== assetId),
      blocks: nextBlocks,
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    });
  }

  addBlock(block: TemplateDefinition['blocks'][number], index?: number): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    const blocks = draft.blocks.slice();
    const insertAt = typeof index === 'number' ? Math.max(0, Math.min(index, blocks.length)) : blocks.length;
    blocks.splice(insertAt, 0, block);

    this.replaceWorkingDraft(this.reindexDraft({
      ...draft,
      blocks,
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    }));
    this.selectBlock(block.id);
  }

  removeBlock(blockId: string): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    const nextBlocks = draft.blocks.filter((block) => block.id !== blockId);
    this.replaceWorkingDraft(this.reindexDraft({
      ...draft,
      blocks: nextBlocks,
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    }));

    const currentSelected = this.state().selected_block_id;
    if (currentSelected === blockId) {
      this.selectBlock(nextBlocks[0]?.id ?? null);
    }
  }

  duplicateBlock(blockId: string, duplicate: TemplateDefinition['blocks'][number]): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    const index = draft.blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;

    const nextBlocks = draft.blocks.slice();
    nextBlocks.splice(index + 1, 0, duplicate);

    this.replaceWorkingDraft(this.reindexDraft({
      ...draft,
      blocks: nextBlocks,
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    }));
    this.selectBlock(duplicate.id);
  }

  moveBlock(blockId: string, direction: 'up' | 'down'): void {
    const draft = this.state().working_draft;
    if (!draft) return;

    const nextBlocks = draft.blocks.slice();
    const index = nextBlocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= nextBlocks.length) return;

    [nextBlocks[index], nextBlocks[swapIndex]] = [nextBlocks[swapIndex], nextBlocks[index]];

    this.replaceWorkingDraft(this.reindexDraft({
      ...draft,
      blocks: nextBlocks,
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    }));
  }

  setPreviewZoom(zoom: number): void {
    this.patchState({
      preview: {
        ...this.state().preview,
        zoom,
      },
    });
  }

  private patchState(patch: Partial<TemplateStudioState>): void {
    this.state.update((current) => {
      const next = { ...current, ...patch };
      return {
        ...next,
        dirty: !this.areTemplatesEqual(next.persisted_draft, next.working_draft),
      };
    });
  }

  private areTemplatesEqual(
    left: TemplateDefinition | null,
    right: TemplateDefinition | null
  ): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private reindexDraft(draft: TemplateDefinition): TemplateDefinition {
    return {
      ...draft,
      blocks: draft.blocks.map((block, index) => ({
        ...block,
        order: index + 1,
      })),
    };
  }
}
