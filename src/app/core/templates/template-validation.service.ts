import { Injectable } from '@angular/core';

import {
  ProposalRenderModel,
  TemplateAssetRef,
  TemplateBlock,
  TemplateDefinition,
  TemplateValidationResult,
  ValidationIssue,
} from './template-studio.models';
import { TEMPLATE_BLOCK_REGISTRY } from './template-block-registry';

@Injectable({
  providedIn: 'root',
})
export class TemplateValidationService {
  validateTemplate(
    template: TemplateDefinition,
    previewProfile?: ProposalRenderModel,
    assets: TemplateAssetRef[] = template.assets
  ): TemplateValidationResult {
    const issues = [
      ...this.validateSchema(template),
      ...this.validateRegistry(template),
      ...this.validateRenderability(template, previewProfile, assets),
    ];

    return {
      errors: issues.filter((issue) => issue.severity === 'error'),
      warnings: issues.filter((issue) => issue.severity === 'warning'),
    };
  }

  validateForPublish(
    template: TemplateDefinition,
    previewProfile?: ProposalRenderModel,
    assets: TemplateAssetRef[] = template.assets
  ): TemplateValidationResult {
    const base = this.validateTemplate(template, previewProfile, assets);
    const issues = [...base.errors, ...base.warnings];
    const enabledBlocks = template.blocks.filter((block) => block.enabled);

    if (!enabledBlocks.length) {
      issues.push(
        this.error(
          'NO_ENABLED_BLOCKS',
          'Enable at least one block before publishing this template.',
          'blocks',
          'render'
        )
      );
    }

    if (!enabledBlocks.some((block) => block.type === 'proposal-items')) {
      issues.push(
        this.error(
          'MISSING_PROPOSAL_ITEMS',
          'A published proposal template must include a Floral Line Items block.',
          'blocks',
          'registry'
        )
      );
    }

    return {
      errors: issues.filter((issue) => issue.severity === 'error'),
      warnings: issues.filter((issue) => issue.severity === 'warning'),
    };
  }

  private validateSchema(template: TemplateDefinition): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (template.schema_version !== '1.0') {
      issues.push(
        this.error(
          'UNSUPPORTED_SCHEMA_VERSION',
          `Template schema version "${template.schema_version}" is not supported.`,
          'schema_version',
          'schema'
        )
      );
    }

    if (!template.name?.trim()) {
      issues.push(
        this.error('MISSING_TEMPLATE_NAME', 'Template name is required.', 'name', 'schema')
      );
    }

    const blockIds = new Set<string>();

    template.blocks.forEach((block, index) => {
      if (!block.id?.trim()) {
        issues.push(
          this.error(
            'MISSING_BLOCK_ID',
            'Every block must have a stable id.',
            `blocks[${index}].id`,
            'schema'
          )
        );
      } else if (blockIds.has(block.id)) {
        issues.push(
          this.error(
            'DUPLICATE_BLOCK_ID',
            `Block id "${block.id}" is duplicated.`,
            `blocks[${index}].id`,
            'schema',
            block.id
          )
        );
      } else {
        blockIds.add(block.id);
      }
    });

    const colors = Object.entries(template.tokens.colors);
    colors.forEach(([key, value]) => {
      if (value && !this.isColorLike(value)) {
        issues.push(
          this.error(
            'INVALID_COLOR_TOKEN',
            `Color token "${key}" must be a valid CSS color string.`,
            `tokens.colors.${key}`,
            'schema'
          )
        );
      }
    });

    if (template.settings.page.margins.top < 24) {
      issues.push(
        this.warning(
          'LOW_PAGE_MARGIN',
          'Top page margin is very small and may clip in PDF output.',
          'settings.page.margins.top',
          'render'
        )
      );
    }

    return issues;
  }

  private validateRegistry(template: TemplateDefinition): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    Object.values(TEMPLATE_BLOCK_REGISTRY).forEach((registryItem) => {
      const instances = template.blocks.filter((block) => block.type === registryItem.type);

      if (
        typeof registryItem.validation.max_instances === 'number' &&
        instances.length > registryItem.validation.max_instances
      ) {
        issues.push(
          this.error(
            'TOO_MANY_BLOCK_INSTANCES',
            `Only ${registryItem.validation.max_instances} "${registryItem.label}" block(s) are allowed.`,
            'blocks',
            'registry'
          )
        );
      }

      if (
        typeof registryItem.validation.min_instances === 'number' &&
        instances.length < registryItem.validation.min_instances
      ) {
        issues.push(
          this.error(
            'MISSING_REQUIRED_BLOCK',
            `At least ${registryItem.validation.min_instances} "${registryItem.label}" block(s) are required.`,
            'blocks',
            'registry'
          )
        );
      }
    });

    template.blocks.forEach((block, index) => {
      const registryItem = TEMPLATE_BLOCK_REGISTRY[block.type];

      if (!registryItem) {
        issues.push(
          this.error(
            'UNKNOWN_BLOCK_TYPE',
            `Block type "${block.type}" is not registered.`,
            `blocks[${index}].type`,
            'registry',
            block.id
          )
        );
        return;
      }

      if (!registryItem.variants.some((variant) => variant.id === block.layout_variant)) {
        issues.push(
          this.error(
            'INVALID_BLOCK_VARIANT',
            `Variant "${block.layout_variant}" is not supported for "${registryItem.label}".`,
            `blocks[${index}].layout_variant`,
            'registry',
            block.id
          )
        );
      }

      (registryItem.validation.required_content_fields ?? []).forEach((path) => {
        const value = this.readPath(block, path.replace(/^content\./, 'content.'));
        if (!this.hasValue(value)) {
          issues.push(
            this.error(
              'MISSING_REQUIRED_BLOCK_CONTENT',
              `Required field "${path}" is missing for "${registryItem.label}".`,
              `blocks[${index}].${path}`,
              'registry',
              block.id
            )
          );
        }
      });
    });

    return issues;
  }

  private validateRenderability(
    template: TemplateDefinition,
    previewProfile?: ProposalRenderModel,
    assets: TemplateAssetRef[] = []
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const assetIds = new Set(assets.map((asset) => asset.id));

    template.blocks.forEach((block, index) => {
      if (!block.enabled) return;

      if (block.type === 'cover') {
        const heroAssetId = this.readPath(block, 'content.hero_asset_id');
        const heroImageSource = this.readPath(block, 'content.hero_image_source');

        if (heroImageSource === 'asset' && heroAssetId && !assetIds.has(String(heroAssetId))) {
          issues.push(
            this.error(
              'MISSING_BLOCK_ASSET',
              'The selected cover hero asset no longer exists.',
              `blocks[${index}].content.hero_asset_id`,
              'render',
              block.id
            )
          );
        }
      }

      const backgroundAssetId = this.readPath(block, 'styles.background_asset_id');
      if (backgroundAssetId && !assetIds.has(String(backgroundAssetId))) {
        issues.push(
          this.error(
            'MISSING_BLOCK_BACKGROUND_ASSET',
            'The selected block background asset no longer exists.',
            `blocks[${index}].styles.background_asset_id`,
            'render',
            block.id
          )
        );
      }

      const registryItem = TEMPLATE_BLOCK_REGISTRY[block.type];
      if (!registryItem || !previewProfile) return;

      const visibleForEventType = this.matchesEventType(block, previewProfile.event.type);
      const hasVisibilityData = this.matchesRequiredDataPaths(block, previewProfile);

      if (!visibleForEventType) {
        issues.push(
          this.warning(
            'BLOCK_HIDDEN_FOR_EVENT_TYPE',
            `"${registryItem.label}" is hidden for the "${previewProfile.event.type}" preview event type.`,
            `blocks[${index}].visibility.event_types`,
            'render',
            block.id
          )
        );
      }

      if (!hasVisibilityData) {
        issues.push(
          this.warning(
            'BLOCK_HIDDEN_FOR_PREVIEW_DATA',
            `"${registryItem.label}" is hidden because its required visibility data paths are missing in the current preview profile.`,
            `blocks[${index}].visibility.requires_data_paths`,
            'render',
            block.id
          )
        );
      }

      registryItem.data_requirements.required_paths.forEach((path) => {
        const value = this.readPath(previewProfile, path);
        if (!this.hasValue(value)) {
          issues.push(
            this.warning(
              'MISSING_PREVIEW_DATA',
              `Preview data does not currently provide "${path}" for "${registryItem.label}".`,
              `blocks[${index}]`,
              'render',
              block.id
            )
          );
        }
      });
    });

    if (template.advanced?.custom_css?.includes('@import')) {
      issues.push(
        this.error(
          'FORBIDDEN_CSS_AT_IMPORT',
          'Advanced CSS cannot use @import.',
          'advanced.custom_css',
          'render'
        )
      );
    }

    return issues;
  }

  private matchesEventType(block: TemplateBlock, eventType: string | null | undefined): boolean {
    const allowedEventTypes = block.visibility?.event_types?.filter((value) => value.trim().length > 0) ?? [];
    if (!allowedEventTypes.length || !eventType) {
      return true;
    }

    const normalizedEventType = eventType.trim().toLowerCase();
    return allowedEventTypes.some((value) => value.trim().toLowerCase() === normalizedEventType);
  }

  private matchesRequiredDataPaths(block: TemplateBlock, previewProfile: ProposalRenderModel): boolean {
    const requiredPaths =
      block.visibility?.requires_data_paths?.filter((value) => value.trim().length > 0) ?? [];
    if (!requiredPaths.length) {
      return true;
    }

    return requiredPaths.every((path) => this.hasValue(this.readPath(previewProfile, path)));
  }

  private isColorLike(value: string): boolean {
    return (
      /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ||
      /^rgb(a)?\(/i.test(value) ||
      /^[a-z]+$/i.test(value)
    );
  }

  private readPath(target: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((value, segment) => {
      if (value == null || typeof value !== 'object') return undefined;
      return (value as Record<string, unknown>)[segment];
    }, target);
  }

  private hasValue(value: unknown): boolean {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  private error(
    code: string,
    message: string,
    path: string,
    source: ValidationIssue['source'],
    blockId?: string
  ): ValidationIssue {
    return { severity: 'error', code, message, path, source, block_id: blockId };
  }

  private warning(
    code: string,
    message: string,
    path: string,
    source: ValidationIssue['source'],
    blockId?: string
  ): ValidationIssue {
    return { severity: 'warning', code, message, path, source, block_id: blockId };
  }
}
