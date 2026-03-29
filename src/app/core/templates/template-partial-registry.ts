import { Injectable } from '@angular/core';

import { TemplateBlockType } from './template-studio.models';

export interface TemplatePartialDefinition {
  key: string;
  blockType: TemplateBlockType;
  variant: string;
}

@Injectable({
  providedIn: 'root',
})
export class TemplatePartialRegistry {
  private readonly partials: TemplatePartialDefinition[] = [
    { key: 'blocks/cover/editorial', blockType: 'cover', variant: 'editorial' },
    { key: 'blocks/cover/minimal', blockType: 'cover', variant: 'minimal' },
    { key: 'blocks/cover/romantic', blockType: 'cover', variant: 'romantic' },
    { key: 'blocks/intro-note/simple', blockType: 'intro-note', variant: 'simple' },
    { key: 'blocks/intro-note/split', blockType: 'intro-note', variant: 'split' },
    { key: 'blocks/event-summary/two-column', blockType: 'event-summary', variant: 'two-column' },
    { key: 'blocks/event-summary/minimal-list', blockType: 'event-summary', variant: 'minimal-list' },
    { key: 'blocks/mood-gallery/grid', blockType: 'mood-gallery', variant: 'grid' },
    { key: 'blocks/mood-gallery/editorial-strip', blockType: 'mood-gallery', variant: 'editorial-strip' },
    { key: 'blocks/proposal-items/stacked', blockType: 'proposal-items', variant: 'stacked' },
    { key: 'blocks/proposal-items/cards', blockType: 'proposal-items', variant: 'cards' },
    { key: 'blocks/proposal-items/editorial-list', blockType: 'proposal-items', variant: 'editorial-list' },
    { key: 'blocks/investment-summary/classic', blockType: 'investment-summary', variant: 'classic' },
    { key: 'blocks/investment-summary/boxed', blockType: 'investment-summary', variant: 'boxed' },
    { key: 'blocks/included-services/list', blockType: 'included-services', variant: 'list' },
    { key: 'blocks/terms-and-next-steps/stacked', blockType: 'terms-and-next-steps', variant: 'stacked' },
    { key: 'blocks/terms-and-next-steps/two-column', blockType: 'terms-and-next-steps', variant: 'two-column' },
    { key: 'blocks/signature-closing/simple', blockType: 'signature-closing', variant: 'simple' },
    { key: 'blocks/signature-closing/editorial', blockType: 'signature-closing', variant: 'editorial' },
  ];

  getPartialKey(blockType: TemplateBlockType, variant: string): string {
    return (
      this.partials.find((partial) => partial.blockType === blockType && partial.variant === variant)
        ?.key ?? `blocks/${blockType}/${variant}`
    );
  }

  isSupportedPartialKey(partialKey: string): boolean {
    return this.partials.some((partial) => partial.key === partialKey);
  }
}
