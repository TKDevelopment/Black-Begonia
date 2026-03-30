import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { TaxRegion } from '../../../core/models/tax-region';
import { TaxRegionRepositoryService } from '../../../core/supabase/repositories/tax-region-repository.service';
import { TaxRegionService } from '../../../core/supabase/services/tax-region.service';
import { ToastService } from '../../../core/services/toast.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { SearchFilterBarComponent, SearchFilterGroup } from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import { AdminTableColumn, EntityTableShellComponent } from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { TaxRegionUpsertModalComponent, TaxRegionUpsertPayload } from './components/tax-region-upsert-modal/tax-region-upsert-modal.component';

@Component({
  selector: 'app-tax-regions',
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
    TaxRegionUpsertModalComponent,
  ],
  templateUrl: './tax-regions.component.html',
})
export class TaxRegionsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taxRegionRepository = inject(TaxRegionRepositoryService);
  private readonly taxRegionService = inject(TaxRegionService);
  private readonly toast = inject(ToastService);

  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Region' },
    { key: 'tax_rate', label: 'Tax Rate' },
    { key: 'scope', label: 'Applies To' },
    { key: 'created_at', label: 'Created' },
  ];

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly detailLoading = signal(true);
  readonly detailError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly createModalOpen = signal(false);
  readonly editModalOpen = signal(false);

  readonly currentTaxRegionId = signal<string | null>(null);
  readonly taxRegions = signal<TaxRegion[]>([]);
  readonly taxRegion = signal<TaxRegion | null>(null);

  readonly searchTerm = signal('');
  readonly statusFilter = signal<'active' | 'inactive' | 'all'>('active');
  readonly sortFilter = signal<'name' | 'created_desc' | 'created_asc' | 'rate_desc' | 'rate_asc'>('name');

  readonly isDetailView = computed(() => !!this.currentTaxRegionId());

  readonly filteredTaxRegions = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const sort = this.sortFilter();

    const filtered = this.taxRegions().filter((region) => {
      const haystack = `${region.name} ${region.authority_name ?? ''}`.toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus = status === 'all' || (status === 'active' ? region.is_active : !region.is_active);
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'rate_desc':
          return b.tax_rate - a.tax_rate;
        case 'rate_asc':
          return a.tax_rate - b.tax_rate;
        default:
          return a.name.localeCompare(b.name);
      }
    });
  });

  readonly filters = computed<SearchFilterGroup[]>(() => [
    {
      key: 'status',
      label: 'Status',
      value: this.statusFilter(),
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'All Regions', value: 'all' },
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
        { label: 'Tax Rate (High to Low)', value: 'rate_desc' },
        { label: 'Tax Rate (Low to High)', value: 'rate_asc' },
      ],
    },
  ]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const taxRegionId = params.get('taxRegionId');
      this.currentTaxRegionId.set(taxRegionId);
      if (taxRegionId) {
        void this.loadTaxRegionDetail(taxRegionId);
      } else {
        void this.loadTaxRegions();
      }
    });
  }

  async loadTaxRegions(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.taxRegions.set(await this.taxRegionRepository.getTaxRegions());
    } catch (error) {
      console.error('[TaxRegionsComponent] loadTaxRegions error:', error);
      this.error.set('We were unable to load tax regions right now.');
      this.taxRegions.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadTaxRegionDetail(taxRegionId: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set(null);

    try {
      const taxRegion = await this.taxRegionRepository.getTaxRegionById(taxRegionId);
      if (!taxRegion) {
        this.taxRegion.set(null);
        this.detailError.set('We could not find this tax region.');
        return;
      }

      this.taxRegion.set(taxRegion);
    } catch (error) {
      console.error('[TaxRegionsComponent] loadTaxRegionDetail error:', error);
      this.taxRegion.set(null);
      this.detailError.set('We were unable to load this tax region right now.');
    } finally {
      this.detailLoading.set(false);
    }
  }

  onSearchChange(value: string): void { this.searchTerm.set(value); }

  onFilterChange(event: { key: string; value: string }): void {
    if (event.key === 'status') this.statusFilter.set(event.value as 'active' | 'inactive' | 'all');
    if (event.key === 'sort') this.sortFilter.set(event.value as 'name' | 'created_desc' | 'created_asc' | 'rate_desc' | 'rate_asc');
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('active');
    this.sortFilter.set('name');
  }

  openCreateModal(): void { this.createModalOpen.set(true); }
  closeCreateModal(): void { this.createModalOpen.set(false); }
  openEditModal(): void { this.editModalOpen.set(true); }
  closeEditModal(): void { this.editModalOpen.set(false); }

  async createTaxRegion(payload: TaxRegionUpsertPayload): Promise<void> {
    if (this.saving()) return;

    try {
      this.saving.set(true);
      const taxRegion = await this.taxRegionService.createTaxRegion(payload);
      this.createModalOpen.set(false);
      this.toast.showToast('Tax region created successfully.', 'success');
      await this.loadTaxRegions();
      await this.router.navigate(['/admin/tax-regions', taxRegion.tax_region_id]);
    } catch (error) {
      console.error('[TaxRegionsComponent] createTaxRegion error:', error);
      this.toast.showToast('We were unable to create the tax region right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async saveTaxRegionEdits(payload: TaxRegionUpsertPayload): Promise<void> {
    const taxRegion = this.taxRegion();
    if (!taxRegion || this.saving()) return;

    try {
      this.saving.set(true);
      await this.taxRegionService.updateTaxRegion(taxRegion.tax_region_id, payload);
      this.editModalOpen.set(false);
      await this.loadTaxRegionDetail(taxRegion.tax_region_id);
      await this.loadTaxRegions();
      this.toast.showToast('Tax region updated successfully.', 'success');
    } catch (error) {
      console.error('[TaxRegionsComponent] saveTaxRegionEdits error:', error);
      this.toast.showToast('We were unable to save tax region changes right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async deactivateCurrentTaxRegion(): Promise<void> {
    const taxRegion = this.taxRegion();
    if (!taxRegion || this.saving()) return;

    const confirmed = window.confirm(`Deactivate ${taxRegion.name}? It will remain available for historical estimate records but will not appear as an active choice in new estimate builds.`);
    if (!confirmed) return;

    try {
      this.saving.set(true);
      await this.taxRegionService.deactivateTaxRegion(taxRegion);
      await this.loadTaxRegionDetail(taxRegion.tax_region_id);
      await this.loadTaxRegions();
      this.toast.showToast('Tax region deactivated.', 'success');
    } catch (error) {
      console.error('[TaxRegionsComponent] deactivateCurrentTaxRegion error:', error);
      this.toast.showToast('We were unable to deactivate the tax region right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async activateCurrentTaxRegion(): Promise<void> {
    const taxRegion = this.taxRegion();
    if (!taxRegion || this.saving()) return;

    try {
      this.saving.set(true);
      await this.taxRegionService.activateTaxRegion(taxRegion);
      await this.loadTaxRegionDetail(taxRegion.tax_region_id);
      await this.loadTaxRegions();
      this.toast.showToast('Tax region activated.', 'success');
    } catch (error) {
      console.error('[TaxRegionsComponent] activateCurrentTaxRegion error:', error);
      this.toast.showToast('We were unable to activate the tax region right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  openTaxRegion(taxRegion: TaxRegion): void { void this.router.navigate(['/admin/tax-regions', taxRegion.tax_region_id]); }
  goBack(): void { void this.router.navigate(['/admin/tax-regions']); }
  retryList(): void { void this.loadTaxRegions(); }
  retryDetail(): void { const id = this.currentTaxRegionId(); if (id) void this.loadTaxRegionDetail(id); }

  formatPercent(value: number | null | undefined): string {
    if (value == null) return '0.00%';
    return `${(value * 100).toFixed(2)}%`;
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not available';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Not set';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }

  getScopeLabel(region: TaxRegion): string {
    const scopes = [
      region.applies_to_products ? 'Products' : null,
      region.applies_to_services ? 'Services' : null,
      region.applies_to_delivery ? 'Delivery' : null,
    ].filter((value): value is string => !!value);

    return scopes.length ? scopes.join(', ') : 'No taxable scopes';
  }
}

