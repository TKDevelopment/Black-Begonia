import { Injectable } from '@angular/core';

import {
  DocumentTemplate,
  DocumentTemplateUpsertInput,
} from '../../models/floral-proposal';
import { DocumentTemplateRepositoryService } from '../repositories/document-template-repository.service';

@Injectable({
  providedIn: 'root',
})
export class DocumentTemplateService {
  constructor(
    private readonly documentTemplateRepository: DocumentTemplateRepositoryService
  ) {}

  async createDocumentTemplate(
    payload: DocumentTemplateUpsertInput
  ): Promise<DocumentTemplate> {
    return this.documentTemplateRepository.createDocumentTemplate(payload);
  }

  async updateDocumentTemplate(
    templateId: string,
    updates: Partial<DocumentTemplateUpsertInput>
  ): Promise<DocumentTemplate> {
    return this.documentTemplateRepository.updateDocumentTemplate(templateId, updates);
  }

  async deactivateTemplate(template: DocumentTemplate): Promise<DocumentTemplate> {
    return this.updateDocumentTemplate(template.template_id, { is_active: false });
  }

  async activateTemplate(template: DocumentTemplate): Promise<DocumentTemplate> {
    return this.updateDocumentTemplate(template.template_id, { is_active: true });
  }
}
