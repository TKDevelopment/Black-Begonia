import { Injectable } from '@angular/core';
import { CreateTaxRegionInput, TaxRegion } from '../../models/tax-region';
import { TaxRegionRepositoryService } from '../repositories/tax-region-repository.service';

@Injectable({
  providedIn: 'root',
})
export class TaxRegionService {
  constructor(private readonly taxRegionRepository: TaxRegionRepositoryService) {}

  createTaxRegion(payload: CreateTaxRegionInput): Promise<TaxRegion> {
    return this.taxRegionRepository.createTaxRegion(payload);
  }

  updateTaxRegion(taxRegionId: string, updates: Partial<TaxRegion>): Promise<TaxRegion> {
    return this.taxRegionRepository.updateTaxRegion(taxRegionId, updates);
  }

  activateTaxRegion(region: TaxRegion): Promise<TaxRegion> {
    return this.taxRegionRepository.updateTaxRegion(region.tax_region_id, {
      is_active: true,
    });
  }

  deactivateTaxRegion(region: TaxRegion): Promise<TaxRegion> {
    return this.taxRegionRepository.updateTaxRegion(region.tax_region_id, {
      is_active: false,
    });
  }
}

