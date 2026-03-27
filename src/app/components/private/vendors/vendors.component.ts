import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CatalogItem } from '../../../core/models/catalog-item';
import { Vendor } from '../../../core/models/vendor';
import { VendorItemPack } from '../../../core/models/vendor-item-pack';
import { CatalogItemRepositoryService } from '../../../core/supabase/repositories/catalog-item-repository.service';
import { VendorRepositoryService } from '../../../core/supabase/repositories/vendor-repository.service';
import { VendorItemPackRepositoryService } from '../../../core/supabase/repositories/vendor-item-pack-repository.service';
import { VendorService } from '../../../core/supabase/services/vendor.service';
import { ToastService } from '../../../core/services/toast.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { SearchFilterBarComponent, SearchFilterGroup } from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import { AdminTableColumn, EntityTableShellComponent } from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { VendorUpsertModalComponent, VendorUpsertPayload } from './components/vendor-upsert-modal/vendor-upsert-modal.component';
import { VendorItemPackModalComponent, VendorItemPackPayload } from './components/vendor-item-pack-modal/vendor-item-pack-modal.component';

@Component({
  selector: 'app-vendors',
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
    VendorUpsertModalComponent,
    VendorItemPackModalComponent,
  ],
  templateUrl: './vendors.component.html',
  styleUrl: './vendors.component.scss',
})
export class VendorsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorRepository = inject(VendorRepositoryService);
  private readonly vendorItemPackRepository = inject(VendorItemPackRepositoryService);
  private readonly catalogItemRepository = inject(CatalogItemRepositoryService);
  private readonly vendorService = inject(VendorService);
  private readonly toast = inject(ToastService);

  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Vendor' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'website', label: 'Website' },
  ];

  loading = signal(true);
  error = signal<string | null>(null);
  detailLoading = signal(true);
  detailError = signal<string | null>(null);
  saving = signal(false);
  createModalOpen = signal(false);
  editModalOpen = signal(false);
  packModalOpen = signal(false);

  currentVendorId = signal<string | null>(null);
  vendors = signal<Vendor[]>([]);
  vendor = signal<Vendor | null>(null);
  vendorItemPacks = signal<VendorItemPack[]>([]);
  selectedPack = signal<VendorItemPack | null>(null);
  catalogItems = signal<CatalogItem[]>([]);

  searchTerm = signal('');
  statusFilter = signal<'active' | 'inactive' | 'all'>('active');
  sortFilter = signal<'name' | 'created_desc' | 'created_asc'>('name');

  readonly isDetailView = computed(() => !!this.currentVendorId());

  readonly filteredVendors = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const sort = this.sortFilter();

    const filtered = this.vendors().filter((vendor) => {
      const haystack = `${vendor.name} ${vendor.email ?? ''} ${vendor.phone ?? ''} ${vendor.website ?? ''}`.toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus =
        status === 'all' || (status === 'active' ? vendor.is_active : !vendor.is_active);

      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (sort === 'created_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return a.name.localeCompare(b.name);
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
        { label: 'All Vendors', value: 'all' },
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
      ],
    },
  ]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const vendorId = params.get('vendorId');
      this.currentVendorId.set(vendorId);
      if (vendorId) {
        void this.loadVendorDetail(vendorId);
      } else {
        void this.loadVendors();
      }
    });
  }

  async loadVendors(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.vendors.set(await this.vendorRepository.getVendors());
    } catch (error) {
      console.error('[VendorsComponent] loadVendors error:', error);
      this.error.set('We were unable to load vendors right now.');
      this.vendors.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadVendorDetail(vendorId: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set(null);
    try {
      const [vendor, packs] = await Promise.all([
        this.vendorRepository.getVendorById(vendorId),
        this.vendorItemPackRepository.getVendorItemPacks(vendorId),
      ]);

      if (!vendor) {
        this.vendor.set(null);
        this.vendorItemPacks.set([]);
        this.detailError.set('We could not find this vendor.');
        return;
      }

      this.vendor.set(vendor);
      this.vendorItemPacks.set(packs);
    } catch (error) {
      console.error('[VendorsComponent] loadVendorDetail error:', error);
      this.vendor.set(null);
      this.vendorItemPacks.set([]);
      this.detailError.set('We were unable to load this vendor right now.');
    } finally {
      this.detailLoading.set(false);
    }
  }

  async ensureCatalogItemsLoaded(): Promise<void> {
    if (this.catalogItems().length) return;
    this.catalogItems.set(await this.catalogItemRepository.getCatalogItems());
  }

  onSearchChange(value: string): void { this.searchTerm.set(value); }
  onFilterChange(event: { key: string; value: string }): void {
    if (event.key === 'status') this.statusFilter.set(event.value as 'active' | 'inactive' | 'all');
    if (event.key === 'sort') this.sortFilter.set(event.value as 'name' | 'created_desc' | 'created_asc');
  }
  resetFilters(): void { this.searchTerm.set(''); this.statusFilter.set('active'); this.sortFilter.set('name'); }
  openCreateModal(): void { this.createModalOpen.set(true); }
  closeCreateModal(): void { this.createModalOpen.set(false); }
  openEditModal(): void { this.editModalOpen.set(true); }
  closeEditModal(): void { this.editModalOpen.set(false); }
  openAddPackModal(): void {
    this.selectedPack.set(null);
    this.packModalOpen.set(true);
    void this.ensureCatalogItemsLoaded();
  }
  openEditPackModal(pack: VendorItemPack): void {
    this.selectedPack.set(pack);
    this.packModalOpen.set(true);
    void this.ensureCatalogItemsLoaded();
  }
  closePackModal(): void {
    this.packModalOpen.set(false);
    this.selectedPack.set(null);
  }

  async createVendor(payload: VendorUpsertPayload): Promise<void> {
    if (this.saving()) return;
    try {
      this.saving.set(true);
      const vendor = await this.vendorService.createVendor(payload);
      this.createModalOpen.set(false);
      this.toast.showToast('Vendor created successfully.', 'success');
      await this.loadVendors();
      await this.router.navigate(['/admin/vendors', vendor.vendor_id]);
    } catch (error) {
      console.error('[VendorsComponent] createVendor error:', error);
      this.toast.showToast('We were unable to create the vendor right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async saveVendorEdits(payload: VendorUpsertPayload): Promise<void> {
    const vendor = this.vendor();
    if (!vendor || this.saving()) return;
    try {
      this.saving.set(true);
      await this.vendorService.updateVendor(vendor.vendor_id, payload);
      this.editModalOpen.set(false);
      await this.loadVendorDetail(vendor.vendor_id);
      await this.loadVendors();
      this.toast.showToast('Vendor updated successfully.', 'success');
    } catch (error) {
      console.error('[VendorsComponent] saveVendorEdits error:', error);
      this.toast.showToast('We were unable to save vendor changes right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async deactivateCurrentVendor(): Promise<void> {
    const vendor = this.vendor();
    if (!vendor || this.saving()) return;
    const confirmed = window.confirm(`Deactivate ${vendor.name}? It will remain available for historical reference but won’t be used for new purchasing defaults.`);
    if (!confirmed) return;

    try {
      this.saving.set(true);
      await this.vendorService.deactivateVendor(vendor);
      await this.loadVendorDetail(vendor.vendor_id);
      await this.loadVendors();
      this.toast.showToast('Vendor deactivated.', 'success');
    } catch (error) {
      console.error('[VendorsComponent] deactivateCurrentVendor error:', error);
      this.toast.showToast('We were unable to deactivate the vendor right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async activateCurrentVendor(): Promise<void> {
    const vendor = this.vendor();
    if (!vendor || this.saving()) return;

    try {
      this.saving.set(true);
      await this.vendorService.activateVendor(vendor);
      await this.loadVendorDetail(vendor.vendor_id);
      await this.loadVendors();
      this.toast.showToast('Vendor activated.', 'success');
    } catch (error) {
      console.error('[VendorsComponent] activateCurrentVendor error:', error);
      this.toast.showToast('We were unable to activate the vendor right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async saveVendorPack(payload: VendorItemPackPayload): Promise<void> {
    const vendor = this.vendor();
    if (!vendor || this.saving()) return;
    try {
      this.saving.set(true);
      const pack = this.selectedPack();
      if (pack) {
        await this.vendorService.updateVendorItemPack(pack.vendor_item_pack_id, payload);
        this.toast.showToast('Vendor pack updated successfully.', 'success');
      } else {
        await this.vendorService.createVendorItemPack({
          vendor_id: vendor.vendor_id,
          ...payload,
        });
        this.toast.showToast('Vendor pack added successfully.', 'success');
      }
      this.closePackModal();
      await this.loadVendorDetail(vendor.vendor_id);
    } catch (error: any) {
      console.error('[VendorsComponent] saveVendorPack error:', error);
      const isDefaultConflict = error?.code === '23505';
      this.toast.showToast(
        isDefaultConflict
          ? 'A default pack already exists for this catalog item. Remove the other default before saving this one.'
          : 'We were unable to save the vendor pack right now.',
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deleteVendorPack(pack: VendorItemPack): Promise<void> {
    const vendor = this.vendor();
    if (!vendor || this.saving()) return;
    const confirmed = window.confirm(`Remove ${pack.purchase_unit_name} for ${pack.item?.name ?? 'this item'}?`);
    if (!confirmed) return;

    try {
      this.saving.set(true);
      await this.vendorService.deleteVendorItemPack(pack.vendor_item_pack_id);
      await this.loadVendorDetail(vendor.vendor_id);
      this.toast.showToast('Vendor pack removed.', 'success');
    } catch (error) {
      console.error('[VendorsComponent] deleteVendorPack error:', error);
      this.toast.showToast('We were unable to remove the vendor pack right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  openVendor(vendor: Vendor): void { void this.router.navigate(['/admin/vendors', vendor.vendor_id]); }
  goBack(): void { void this.router.navigate(['/admin/vendors']); }
  retryList(): void { void this.loadVendors(); }
  retryDetail(): void { const id = this.currentVendorId(); if (id) void this.loadVendorDetail(id); }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Not set';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not available';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  formatUnitPrice(pack: VendorItemPack): string {
    if (!pack.units_per_pack) return '$0.00';
    return this.formatCurrency(pack.pack_price / pack.units_per_pack);
  }

  formatLabel(value: string | null | undefined): string {
    if (!value) return 'Not provided';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
