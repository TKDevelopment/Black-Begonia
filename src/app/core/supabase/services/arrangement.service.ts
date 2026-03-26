import { Injectable } from '@angular/core';
import { Arrangement } from '../../models/arrangement';
import { ArrangementComponent, CreateArrangementComponentInput } from '../../models/arrangement-component';
import { CatalogItem } from '../../models/catalog-item';
import { LaborSettings } from '../../models/labor-settings';
import { ArrangementRepositoryService } from '../repositories/arrangement-repository.service';
import { ArrangementComponentRepositoryService } from '../repositories/arrangement-component-repository.service';

@Injectable({
  providedIn: 'root',
})
export class ArrangementService {
  constructor(
    private arrangementRepository: ArrangementRepositoryService,
    private arrangementComponentRepository: ArrangementComponentRepositoryService
  ) {}

  async activateArrangement(arrangement: Arrangement): Promise<Arrangement> {
    return this.arrangementRepository.updateArrangement(arrangement.arrangement_id, {
      is_active: true,
    });
  }

  async deactivateArrangement(arrangement: Arrangement): Promise<Arrangement> {
    return this.arrangementRepository.updateArrangement(arrangement.arrangement_id, {
      is_active: false,
    });
  }

  async createArrangementComponent(payload: CreateArrangementComponentInput): Promise<ArrangementComponent> {
    return this.arrangementComponentRepository.createArrangementComponent(payload);
  }

  async updateArrangementComponent(componentId: string, updates: Partial<ArrangementComponent>): Promise<ArrangementComponent> {
    return this.arrangementComponentRepository.updateArrangementComponent(componentId, updates);
  }

  deleteArrangementComponent(componentId: string): Promise<void> {
    return this.arrangementComponentRepository.deleteArrangementComponent(componentId);
  }

  calculateArrangementTotals(
    components: ArrangementComponent[],
    laborSettings: LaborSettings | null,
    designLaborHours: number,
    markupPercent: number
  ): { calculatedCost: number; suggestedSellPrice: number } {
    const componentCost = components.reduce((total, component) => {
      const item = component.item;
      if (!item) return total;

      return total + component.quantity_per_arrangement * item.base_unit_cost;
    }, 0);

    const laborHours = Math.max(designLaborHours, laborSettings?.minimum_billable_hours ?? 0);
    const laborCost = (laborSettings?.design_hourly_rate ?? 0) * laborHours;
    const calculatedCost = Number((componentCost + laborCost).toFixed(2));
    const suggestedSellPrice = Number((calculatedCost * (1 + markupPercent / 100)).toFixed(2));

    return { calculatedCost, suggestedSellPrice };
  }

  async syncArrangementPricing(
    arrangement: Arrangement,
    components: ArrangementComponent[],
    laborSettings: LaborSettings | null
  ): Promise<Arrangement> {
    const pricing = this.calculateArrangementTotals(
      components,
      laborSettings,
      arrangement.design_labor_hours,
      arrangement.markup_percent
    );

    return this.arrangementRepository.updateArrangement(arrangement.arrangement_id, {
      calculated_cost: pricing.calculatedCost,
      suggested_sell_price: pricing.suggestedSellPrice,
    });
  }
}
