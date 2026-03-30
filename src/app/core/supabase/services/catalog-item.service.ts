import { Injectable } from '@angular/core';
import { CatalogItem, CreateCatalogItemInput } from '../../models/catalog-item';
import { CatalogItemRepositoryService } from '../repositories/catalog-item-repository.service';

@Injectable({
  providedIn: 'root',
})
export class CatalogItemService {
  constructor(private catalogItemRepository: CatalogItemRepositoryService) {}

  createCatalogItem(payload: CreateCatalogItemInput): Promise<CatalogItem> {
    return this.catalogItemRepository.createCatalogItem(payload);
  }

  updateCatalogItem(itemId: string, updates: Partial<CatalogItem>): Promise<CatalogItem> {
    return this.catalogItemRepository.updateCatalogItem(itemId, updates);
  }

  async deactivateCatalogItem(item: CatalogItem): Promise<CatalogItem> {
    return this.catalogItemRepository.updateCatalogItem(item.item_id, {
      is_active: false,
    });
  }

  async activateCatalogItem(item: CatalogItem): Promise<CatalogItem> {
    return this.catalogItemRepository.updateCatalogItem(item.item_id, {
      is_active: true,
    });
  }
}
