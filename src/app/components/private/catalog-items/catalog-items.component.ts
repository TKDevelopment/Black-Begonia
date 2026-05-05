import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CatalogItem, CatalogItemType, CatalogUnitType } from '../../../core/models/catalog-item';
import { CatalogItemRepositoryService } from '../../../core/supabase/repositories/catalog-item-repository.service';
import { CatalogItemService } from '../../../core/supabase/services/catalog-item.service';
import { ToastService } from '../../../core/services/toast.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { SearchFilterBarComponent, SearchFilterGroup } from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import { AdminTableColumn, EntityTableShellComponent } from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { CatalogItemUpsertModalComponent, CatalogItemUpsertPayload } from './components/catalog-item-upsert-modal/catalog-item-upsert-modal.component';

@Component({
  selector: 'app-catalog-items',
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
    CatalogItemUpsertModalComponent,
  ],
  templateUrl: './catalog-items.component.html',
  styleUrl: './catalog-items.component.scss',
})
export class CatalogItemsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogItemRepository = inject(CatalogItemRepositoryService);
  private readonly catalogItemService = inject(CatalogItemService);
  private readonly toast = inject(ToastService);

  readonly itemTypeOptions: CatalogItemType[] = ['flower', 'greenery', 'hardgood', 'packaging', 'labor', 'fee', 'other'];
  readonly unitTypeOptions: CatalogUnitType[] = ['stem', 'bunch', 'box', 'block', 'piece', 'hour', 'foot', 'bundle', 'other'];
  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Item' },
    { key: 'item_type', label: 'Type' },
    { key: 'unit_type', label: 'Unit' },
    { key: 'pack_quantity', label: 'Pack Qty' },
    { key: 'base_unit_cost', label: 'Unit Cost' },
  ];

  loading = signal(true);
  error = signal<string | null>(null);
  detailLoading = signal(true);
  detailError = signal<string | null>(null);
  saving = signal(false);
  createModalOpen = signal(false);
  editModalOpen = signal(false);

  currentItemId = signal<string | null>(null);
  items = signal<CatalogItem[]>([]);
  item = signal<CatalogItem | null>(null);

  searchTerm = signal('');
  typeFilter = signal('all');
  unitFilter = signal('all');
  statusFilter = signal<'active' | 'inactive' | 'all'>('active');
  sortFilter = signal<'name' | 'created_desc' | 'created_asc' | 'cost_desc' | 'cost_asc'>('name');

  readonly isDetailView = computed(() => !!this.currentItemId());

  readonly filteredItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const type = this.typeFilter();
    const unit = this.unitFilter();
    const status = this.statusFilter();
    const sort = this.sortFilter();

    const filtered = this.items().filter((item) => {
      const haystack = `${item.name} ${item.sku ?? ''} ${item.color ?? ''} ${item.variety ?? ''}`.toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesType = type === 'all' || item.item_type === type;
      const matchesUnit = unit === 'all' || item.unit_type === unit;
      const matchesStatus =
        status === 'all' || (status === 'active' ? item.is_active : !item.is_active);

      return matchesSearch && matchesType && matchesUnit && matchesStatus;
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'cost_desc':
          return b.base_unit_cost - a.base_unit_cost;
        case 'cost_asc':
          return a.base_unit_cost - b.base_unit_cost;
        default:
          return a.name.localeCompare(b.name);
      }
    });
  });

  readonly filters = computed<SearchFilterGroup[]>(() => [
    {
      key: 'item_type',
      label: 'Item Type',
      value: this.typeFilter(),
      options: [
        { label: 'All Types', value: 'all' },
        ...this.itemTypeOptions.map((option) => ({ label: this.formatLabel(option), value: option })),
      ],
    },
    {
      key: 'unit_type',
      label: 'Unit Type',
      value: this.unitFilter(),
      options: [
        { label: 'All Units', value: 'all' },
        ...this.unitTypeOptions.map((option) => ({ label: this.formatLabel(option), value: option })),
      ],
    },
    {
      key: 'status',
      label: 'Status',
      value: this.statusFilter(),
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'All Items', value: 'all' },
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
        { label: 'Unit Cost (High to Low)', value: 'cost_desc' },
        { label: 'Unit Cost (Low to High)', value: 'cost_asc' },
      ],
    },
  ]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const itemId = params.get('itemId');
      this.currentItemId.set(itemId);
      if (itemId) {
        void this.loadCatalogItemDetail(itemId);
      } else {
        void this.loadCatalogItems();
      }
    });
  }

  async loadCatalogItems(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.catalogItemRepository.getCatalogItems());
    } catch (error) {
      console.error('[CatalogItemsComponent] loadCatalogItems error:', error);
      this.error.set('We were unable to load catalog items right now.');
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadCatalogItemDetail(itemId: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set(null);
    try {
      const item = await this.catalogItemRepository.getCatalogItemById(itemId);
      if (!item) {
        this.item.set(null);
        this.detailError.set('We could not find this catalog item.');
        return;
      }

      this.item.set(item);
    } catch (error) {
      console.error('[CatalogItemsComponent] loadCatalogItemDetail error:', error);
      this.item.set(null);
      this.detailError.set('We were unable to load this catalog item right now.');
    } finally {
      this.detailLoading.set(false);
    }
  }

  onSearchChange(value: string): void { this.searchTerm.set(value); }

  onFilterChange(event: { key: string; value: string }): void {
    if (event.key === 'item_type') this.typeFilter.set(event.value);
    if (event.key === 'unit_type') this.unitFilter.set(event.value);
    if (event.key === 'status') this.statusFilter.set(event.value as 'active' | 'inactive' | 'all');
    if (event.key === 'sort') this.sortFilter.set(event.value as 'name' | 'created_desc' | 'created_asc' | 'cost_desc' | 'cost_asc');
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.typeFilter.set('all');
    this.unitFilter.set('all');
    this.statusFilter.set('active');
    this.sortFilter.set('name');
  }

  openCreateModal(): void { this.createModalOpen.set(true); }
  closeCreateModal(): void { this.createModalOpen.set(false); }
  openEditModal(): void { this.editModalOpen.set(true); }
  closeEditModal(): void { this.editModalOpen.set(false); }

  async createItem(payload: CatalogItemUpsertPayload): Promise<void> {
    if (this.saving()) return;
    try {
      this.saving.set(true);
      const item = await this.catalogItemService.createCatalogItem(payload);
      this.createModalOpen.set(false);
      this.toast.showToast('Catalog item created successfully.', 'success');
      await this.loadCatalogItems();
      await this.router.navigate(['/admin/catalog-items', item.item_id]);
    } catch (error: any) {
      console.error('[CatalogItemsComponent] createItem error:', error);
      const isDuplicate = error?.code === '23505';
      this.toast.showToast(
        isDuplicate ? 'This SKU already exists. Choose a different SKU.' : 'We were unable to create the catalog item right now.',
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }

  async saveItemEdits(payload: CatalogItemUpsertPayload): Promise<void> {
    const item = this.item();
    if (!item || this.saving()) return;
    try {
      this.saving.set(true);
      await this.catalogItemService.updateCatalogItem(item.item_id, payload);
      this.editModalOpen.set(false);
      await this.loadCatalogItemDetail(item.item_id);
      await this.loadCatalogItems();
      this.toast.showToast('Catalog item updated successfully.', 'success');
    } catch (error: any) {
      console.error('[CatalogItemsComponent] saveItemEdits error:', error);
      const isDuplicate = error?.code === '23505';
      this.toast.showToast(
        isDuplicate ? 'This SKU already exists. Choose a different SKU.' : 'We were unable to save catalog item changes right now.',
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deactivateCurrentItem(): Promise<void> {
    const item = this.item();
    if (!item || this.saving()) return;
    const confirmed = window.confirm(`Deactivate ${item.name}? It will remain in the catalog but won't be available for new Floral Proposal use.`);
    if (!confirmed) return;

    try {
      this.saving.set(true);
      await this.catalogItemService.deactivateCatalogItem(item);
      await this.loadCatalogItemDetail(item.item_id);
      await this.loadCatalogItems();
      this.toast.showToast('Catalog item deactivated.', 'success');
    } catch (error) {
      console.error('[CatalogItemsComponent] deactivateCurrentItem error:', error);
      this.toast.showToast('We were unable to deactivate the catalog item right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async activateCurrentItem(): Promise<void> {
    const item = this.item();
    if (!item || this.saving()) return;

    try {
      this.saving.set(true);
      await this.catalogItemService.activateCatalogItem(item);
      await this.loadCatalogItemDetail(item.item_id);
      await this.loadCatalogItems();
      this.toast.showToast('Catalog item activated.', 'success');
    } catch (error) {
      console.error('[CatalogItemsComponent] activateCurrentItem error:', error);
      this.toast.showToast('We were unable to activate the catalog item right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  openItem(item: CatalogItem): void { void this.router.navigate(['/admin/catalog-items', item.item_id]); }
  goBack(): void { void this.router.navigate(['/admin/catalog-items']); }
  retryList(): void { void this.loadCatalogItems(); }
  retryDetail(): void { const id = this.currentItemId(); if (id) void this.loadCatalogItemDetail(id); }

  formatLabel(value: string | null | undefined): string {
    if (!value) return 'Not provided';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  formatPackQuantity(item: CatalogItem): string {
    if (
      item.unit_type !== 'bunch' &&
      item.unit_type !== 'bundle' &&
      item.unit_type !== 'box' &&
      item.unit_type !== 'stem' &&
      item.unit_type !== 'block' &&
      item.unit_type !== 'piece'
    ) {
      return '-';
    }

    return item.pack_quantity != null ? String(item.pack_quantity) : 'Not set';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Not set';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not available';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }

  getItemTypeClasses(type: CatalogItemType): string {
    switch (type) {
      case 'flower': return 'bg-rose-100 text-rose-700';
      case 'greenery': return 'bg-emerald-100 text-emerald-700';
      case 'hardgood': return 'bg-amber-100 text-amber-700';
      case 'packaging': return 'bg-sky-100 text-sky-700';
      case 'labor': return 'bg-violet-100 text-violet-700';
      case 'fee': return 'bg-blue-100 text-blue-700';
      default: return 'bg-stone-100 text-stone-700';
    }
  }
}
