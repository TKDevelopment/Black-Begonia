import { Injectable } from '@angular/core';

import { TemplateDefinition, TemplateStudioStatus } from './template-studio.models';

@Injectable({
  providedIn: 'root',
})
export class TemplateVersioningService {
  createPublishedSnapshot(
    draft: TemplateDefinition,
    options?: {
      publishedAt?: string;
      basedOnTemplateId?: string | null;
      basedOnVersion?: number | null;
    }
  ): TemplateDefinition {
    const publishedAt = options?.publishedAt ?? new Date().toISOString();
    const nextVersion = (draft.version ?? 0) + 1;

    return {
      ...draft,
      status: 'published',
      version: nextVersion,
      metadata: {
        ...draft.metadata,
        published_at: publishedAt,
        based_on_template_id: options?.basedOnTemplateId ?? draft.id,
        based_on_version: options?.basedOnVersion ?? draft.version,
        updated_at: publishedAt,
      },
    };
  }

  createDerivedDraft(
    source: TemplateDefinition,
    status: TemplateStudioStatus = 'draft'
  ): TemplateDefinition {
    const timestamp = new Date().toISOString();

    return {
      ...source,
      status,
      metadata: {
        ...source.metadata,
        based_on_template_id: source.id,
        based_on_version: source.version,
        updated_at: timestamp,
      },
    };
  }
}
