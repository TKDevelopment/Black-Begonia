import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Arrangement } from '../../../core/models/arrangement';
import { ArrangementComponent } from '../../../core/models/arrangement-component';
import { CatalogItem } from '../../../core/models/catalog-item';
import { LaborSettings } from '../../../core/models/labor-settings';
import { ArrangementRepositoryService } from '../../../core/supabase/repositories/arrangement-repository.service';
import { ArrangementComponentRepositoryService } from '../../../core/supabase/repositories/arrangement-component-repository.service';
import { CatalogItemRepositoryService } from '../../../core/supabase/repositories/catalog-item-repository.service';
import { LaborSettingsRepositoryService } from '../../../core/supabase/repositories/labor-settings-repository.service';
import { ArrangementService } from '../../../core/supabase/services/arrangement.service';
import { ToastService } from '../../../core/services/toast.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { SearchFilterBarComponent, SearchFilterGroup } from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import { AdminTableColumn, EntityTableShellComponent } from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { ArrangementUpsertModalComponent, ArrangementUpsertPayload } from './components/arrangement-upsert-modal/arrangement-upsert-modal.component';
import { ArrangementComponentModalComponent, ArrangementComponentPayload } from './components/arrangement-component-modal/arrangement-component-modal.component';

@Component({
  selector: 'app-arrangements',
  standalone: true,
  imports: [
    CommonModule,
    CrmPageHeaderComponent,
    SearchFilterBarComponent,
    EntityTableShellComponent,
    EntityTableCellDirective,
    EntityDetailShellComponent,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
    ArrangementUpsertModalComponent,
    ArrangementComponentModalComponent,
  ],
  templateUrl: './arrangements.component.html',
  styleUrl: './arrangements.component.scss',
})
export class ArrangementsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly arrangementRepository = inject(ArrangementRepositoryService);
  private readonly arrangementComponentRepository = inject(ArrangementComponentRepositoryService);
  private readonly catalogItemRepository = inject(CatalogItemRepositoryService);
  private readonly laborSettingsRepository = inject(LaborSettingsRepositoryService);
  private readonly arrangementService = inject(ArrangementService);
  private readonly toast = inject(ToastService);

  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Arrangement' },
    { key: 'category', label: 'Category' },
    { key: 'calculated_cost', label: 'Cost' },
    { key: 'suggested_sell_price', label: 'Suggested Sell' },
    { key: 'manual_override_sell_price', label: 'Override Sell' },
  ];

  loading = signal(true);
  error = signal<string | null>(null);
  detailLoading = signal(true);
  detailError = signal<string | null>(null);
  saving = signal(false);
  createModalOpen = signal(false);
  editModalOpen = signal(false);
  componentModalOpen = signal(false);

  currentArrangementId = signal<string | null>(null);
  arrangements = signal<Arrangement[]>([]);
  arrangement = signal<Arrangement | null>(null);
  components = signal<ArrangementComponent[]>([]);
  selectedComponent = signal<ArrangementComponent | null>(null);
  catalogItems = signal<CatalogItem[]>([]);
  laborSettings = signal<LaborSettings[]>([]);

  searchTerm = signal('');
  categoryFilter = signal('all');
  statusFilter = signal<'active' | 'inactive' | 'all'>('active');
  sortFilter = signal<'name' | 'created_desc' | 'created_asc' | 'cost_desc' | 'cost_asc'>('name');

  readonly isDetailView = computed(() => !!this.currentArrangementId());

  readonly categoryOptions = computed(() => {
    return Array.from(new Set(this.arrangements().map((arrangement) => arrangement.category).filter((value): value is string => !!value))).sort();
  });

  readonly filteredArrangements = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const category = this.categoryFilter();
    const status = this.statusFilter();
    const sort = this.sortFilter();

    const filtered = this.arrangements().filter((arrangement) => {
      const haystack = `${arrangement.name} ${arrangement.category ?? ''} ${arrangement.description ?? ''}`.toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesCategory = category === 'all' || arrangement.category === category;
      const matchesStatus = status === 'all' || (status === 'active' ? arrangement.is_active : !arrangement.is_active);
      return matchesSearch && matchesCategory && matchesStatus;
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case 'created_desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'created_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'cost_desc': return b.calculated_cost - a.calculated_cost;
        case 'cost_asc': return a.calculated_cost - b.calculated_cost;
        default: return a.name.localeCompare(b.name);
      }
    });
  });

  readonly filters = computed<SearchFilterGroup[]>(() => [
    {
      key: 'category',
      label: 'Category',
      value: this.categoryFilter(),
      options: [
        { label: 'All Categories', value: 'all' },
        ...this.categoryOptions().map((category) => ({ label: category, value: category })),
      ],
    },
    {
      key: 'status',
      label: 'Status',
      value: this.statusFilter(),
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'All Arrangements', value: 'all' },
      ],
    },
    {
      key: 'sort',
      label: 'Sort By',
      value: this.sortFilter(),
      options: [
        { label: 'Name', value: 'name' },
        { label: 'Created Date (Newest)', value: 'created_desc' },
        { label: 'Created Date (Oldest)', value: 'created_asc' },
        { label: 'Calculated Cost (High to Low)', value: 'cost_desc' },
        { label: 'Calculated Cost (Low to High)', value: 'cost_asc' },
      ],
    },
  ]);

  ngOnInit(): void {
    void this.ensureReferenceDataLoaded();

    this.route.paramMap.subscribe((params) => {
      const arrangementId = params.get('arrangementId');
      this.currentArrangementId.set(arrangementId);
      if (arrangementId) {
        void this.loadArrangementDetail(arrangementId);
      } else {
        void this.loadArrangements();
      }
    });
  }

  async ensureReferenceDataLoaded(): Promise<void> {
    if (!this.catalogItems().length) {
      const items = await this.catalogItemRepository.getCatalogItems();
      this.catalogItems.set(items.filter((item) => item.is_active));
    }

    if (!this.laborSettings().length) {
      this.laborSettings.set(await this.laborSettingsRepository.getLaborSettings());
    }
  }

  async loadArrangements(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.arrangements.set(await this.arrangementRepository.getArrangements());
    } catch (error) {
      console.error('[ArrangementsComponent] loadArrangements error:', error);
      this.error.set('We were unable to load arrangements right now.');
      this.arrangements.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadArrangementDetail(arrangementId: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set(null);
    try {
      const [arrangement, components] = await Promise.all([
        this.arrangementRepository.getArrangementById(arrangementId),
        this.arrangementComponentRepository.getArrangementComponents(arrangementId),
      ]);

      if (!arrangement) {
        this.arrangement.set(null);
        this.components.set([]);
        this.detailError.set('We could not find this arrangement.');
        return;
      }

      this.arrangement.set(arrangement);
      this.components.set(components);
    } catch (error) {
      console.error('[ArrangementsComponent] loadArrangementDetail error:', error);
      this.arrangement.set(null);
      this.components.set([]);
      this.detailError.set('We were unable to load this arrangement right now.');
    } finally {
      this.detailLoading.set(false);
    }
  }

  onSearchChange(value: string): void { this.searchTerm.set(value); }
  onFilterChange(event: { key: string; value: string }): void {
    if (event.key === 'category') this.categoryFilter.set(event.value);
    if (event.key === 'status') this.statusFilter.set(event.value as 'active' | 'inactive' | 'all');
    if (event.key === 'sort') this.sortFilter.set(event.value as 'name' | 'created_desc' | 'created_asc' | 'cost_desc' | 'cost_asc');
  }
  resetFilters(): void {
    this.searchTerm.set('');
    this.categoryFilter.set('all');
    this.statusFilter.set('active');
    this.sortFilter.set('name');
  }
  openCreateModal(): void { this.createModalOpen.set(true); }
  closeCreateModal(): void { this.createModalOpen.set(false); }
  openEditModal(): void { this.editModalOpen.set(true); }
  closeEditModal(): void { this.editModalOpen.set(false); }
  openAddComponentModal(): void { this.selectedComponent.set(null); this.componentModalOpen.set(true); }
  openEditComponentModal(component: ArrangementComponent): void { this.selectedComponent.set(component); this.componentModalOpen.set(true); }
  closeComponentModal(): void { this.componentModalOpen.set(false); this.selectedComponent.set(null); }

  async createArrangement(payload: ArrangementUpsertPayload): Promise<void> {
    if (this.saving()) return;
    try {
      this.saving.set(true);
      const labor = this.resolveLaborSettings(payload.labor_settings_id);
      const arrangement = await this.arrangementRepository.createArrangement({
        ...payload,
        calculated_cost: Number(((Math.max(payload.design_labor_hours, labor?.minimum_billable_hours ?? 0)) * (labor?.design_hourly_rate ?? 0)).toFixed(2)),
        suggested_sell_price: Number((((Math.max(payload.design_labor_hours, labor?.minimum_billable_hours ?? 0)) * (labor?.design_hourly_rate ?? 0)) * (1 + payload.markup_percent / 100)).toFixed(2)),
      });
      this.createModalOpen.set(false);
      this.toast.showToast('Arrangement created successfully.', 'success');
      await this.loadArrangements();
      await this.router.navigate(['/admin/arrangements', arrangement.arrangement_id]);
    } catch (error) {
      console.error('[ArrangementsComponent] createArrangement error:', error);
      this.toast.showToast('We were unable to create the arrangement right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async saveArrangementEdits(payload: ArrangementUpsertPayload): Promise<void> {
    const arrangement = this.arrangement();
    if (!arrangement || this.saving()) return;
    try {
      this.saving.set(true);
      const labor = this.resolveLaborSettings(payload.labor_settings_id);
      const pricing = this.arrangementService.calculateArrangementTotals(
        this.components(),
        labor,
        payload.design_labor_hours,
        payload.markup_percent
      );
      await this.arrangementRepository.updateArrangement(arrangement.arrangement_id, {
        ...payload,
        calculated_cost: pricing.calculatedCost,
        suggested_sell_price: pricing.suggestedSellPrice,
      });
      this.editModalOpen.set(false);
      await this.loadArrangementDetail(arrangement.arrangement_id);
      await this.loadArrangements();
      this.toast.showToast('Arrangement updated successfully.', 'success');
    } catch (error) {
      console.error('[ArrangementsComponent] saveArrangementEdits error:', error);
      this.toast.showToast('We were unable to save arrangement changes right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async activateCurrentArrangement(): Promise<void> {
    const arrangement = this.arrangement();
    if (!arrangement || this.saving()) return;
    try {
      this.saving.set(true);
      await this.arrangementService.activateArrangement(arrangement);
      await this.loadArrangementDetail(arrangement.arrangement_id);
      await this.loadArrangements();
      this.toast.showToast('Arrangement activated.', 'success');
    } catch (error) {
      console.error('[ArrangementsComponent] activateCurrentArrangement error:', error);
      this.toast.showToast('We were unable to activate the arrangement right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async deactivateCurrentArrangement(): Promise<void> {
    const arrangement = this.arrangement();
    if (!arrangement || this.saving()) return;
    const confirmed = window.confirm(`Deactivate ${arrangement.name}? It will remain available for historical estimates but not for new recipe selection.`);
    if (!confirmed) return;
    try {
      this.saving.set(true);
      await this.arrangementService.deactivateArrangement(arrangement);
      await this.loadArrangementDetail(arrangement.arrangement_id);
      await this.loadArrangements();
      this.toast.showToast('Arrangement deactivated.', 'success');
    } catch (error) {
      console.error('[ArrangementsComponent] deactivateCurrentArrangement error:', error);
      this.toast.showToast('We were unable to deactivate the arrangement right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async saveComponent(payload: ArrangementComponentPayload): Promise<void> {
    const arrangement = this.arrangement();
    if (!arrangement || this.saving()) return;
    try {
      this.saving.set(true);
      const component = this.selectedComponent();
      if (component) {
        await this.arrangementService.updateArrangementComponent(component.arrangement_component_id, payload);
        this.toast.showToast('Arrangement component updated.', 'success');
      } else {
        await this.arrangementService.createArrangementComponent({
          arrangement_id: arrangement.arrangement_id,
          ...payload,
        });
        this.toast.showToast('Arrangement component added.', 'success');
      }
      this.closeComponentModal();
      await this.loadArrangementDetail(arrangement.arrangement_id);
      const refreshedArrangement = this.arrangement();
      if (refreshedArrangement) {
        const synced = await this.arrangementService.syncArrangementPricing(
          refreshedArrangement,
          this.components(),
          this.resolveLaborSettings(refreshedArrangement.labor_settings_id)
        );
        this.arrangement.set(synced);
      }
      await this.loadArrangements();
    } catch (error) {
      console.error('[ArrangementsComponent] saveComponent error:', error);
      this.toast.showToast('We were unable to save the arrangement component right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteComponent(component: ArrangementComponent): Promise<void> {
    const arrangement = this.arrangement();
    if (!arrangement || this.saving()) return;
    const confirmed = window.confirm(`Remove ${component.item?.name ?? 'this component'} from ${arrangement.name}?`);
    if (!confirmed) return;
    try {
      this.saving.set(true);
      await this.arrangementService.deleteArrangementComponent(component.arrangement_component_id);
      await this.loadArrangementDetail(arrangement.arrangement_id);
      const refreshedArrangement = this.arrangement();
      if (refreshedArrangement) {
        const synced = await this.arrangementService.syncArrangementPricing(
          refreshedArrangement,
          this.components(),
          this.resolveLaborSettings(refreshedArrangement.labor_settings_id)
        );
        this.arrangement.set(synced);
      }
      await this.loadArrangements();
      this.toast.showToast('Arrangement component removed.', 'success');
    } catch (error) {
      console.error('[ArrangementsComponent] deleteComponent error:', error);
      this.toast.showToast('We were unable to remove the arrangement component right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  openArrangement(arrangement: Arrangement): void { void this.router.navigate(['/admin/arrangements', arrangement.arrangement_id]); }
  goBack(): void { void this.router.navigate(['/admin/arrangements']); }
  retryList(): void { void this.loadArrangements(); }
  retryDetail(): void { const id = this.currentArrangementId(); if (id) void this.loadArrangementDetail(id); }

  resolveLaborSettings(laborSettingsId: string | null | undefined): LaborSettings | null {
    if (!laborSettingsId) return null;
    return this.laborSettings().find((setting) => setting.labor_settings_id === laborSettingsId) ?? null;
  }

  formatLabel(value: string | null | undefined): string {
    if (!value) return 'Not provided';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Not set';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not available';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }
}
