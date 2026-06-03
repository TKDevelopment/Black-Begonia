import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';

import { testCatalogItem } from '../../../core/testing/workflow-fixtures';
import {
  createParamMapSubject,
  createRouterSpy,
  createToastSpy,
  expectToast,
  flushCrmPromises,
} from '../../../core/testing/crm-testing';
import { CatalogItemRepositoryService } from '../../../core/supabase/repositories/catalog-item-repository.service';
import { CatalogItemService } from '../../../core/supabase/services/catalog-item.service';
import { ToastService } from '../../../core/services/toast.service';
import { CatalogItemsComponent } from './catalog-items.component';

describe('CatalogItemsComponent', () => {
  let component: CatalogItemsComponent;
  let fixture: ComponentFixture<CatalogItemsComponent>;
  let routeParams: ReturnType<typeof createParamMapSubject>;
  let router: jasmine.SpyObj<Router>;
  let repository: jasmine.SpyObj<CatalogItemRepositoryService>;
  let service: jasmine.SpyObj<CatalogItemService>;
  let toast: jasmine.SpyObj<ToastService>;

  const inactiveItem = {
    ...testCatalogItem,
    item_id: 'catalog-inactive-001',
    name: 'Inactive Ribbon',
    item_type: 'hardgood' as const,
    unit_type: 'piece' as const,
    is_active: false,
    base_unit_cost: 5,
    created_at: '2026-06-03T12:00:00.000Z',
  };

  beforeEach(async () => {
    routeParams = createParamMapSubject();
    router = createRouterSpy();
    router.navigate.and.resolveTo(true);
    repository = jasmine.createSpyObj<CatalogItemRepositoryService>(
      'CatalogItemRepositoryService',
      ['getCatalogItems', 'getCatalogItemById']
    );
    service = jasmine.createSpyObj<CatalogItemService>('CatalogItemService', [
      'createCatalogItem',
      'updateCatalogItem',
      'deactivateCatalogItem',
      'activateCatalogItem',
    ]);
    toast = createToastSpy();

    repository.getCatalogItems.and.resolveTo([testCatalogItem, inactiveItem]);
    repository.getCatalogItemById.and.resolveTo(testCatalogItem);

    await TestBed.configureTestingModule({
      imports: [CatalogItemsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: routeParams.asObservable() } },
        { provide: Router, useValue: router },
        { provide: CatalogItemRepositoryService, useValue: repository },
        { provide: CatalogItemService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    })
      .overrideComponent(CatalogItemsComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(CatalogItemsComponent);
    component = fixture.componentInstance;
  });

  it('loads catalog items and handles empty list results', async () => {
    await component.loadCatalogItems();

    expect(component.loading()).toBeFalse();
    expect(component.items()).toEqual([testCatalogItem, inactiveItem]);

    repository.getCatalogItems.and.resolveTo([]);
    await component.loadCatalogItems();
    expect(component.items()).toEqual([]);
  });

  it('sets a list error when catalog loading fails', async () => {
    spyOn(console, 'error');
    repository.getCatalogItems.and.rejectWith(new Error('catalog unavailable'));

    await component.loadCatalogItems();

    expect(component.items()).toEqual([]);
    expect(component.error()).toBe('We were unable to load catalog items right now.');
  });

  it('filters catalog items by search, type, unit, status, and sort', () => {
    component.items.set([testCatalogItem, inactiveItem]);

    component.onSearchChange('inactive');
    component.onFilterChange({ key: 'item_type', value: 'hardgood' });
    component.onFilterChange({ key: 'unit_type', value: 'piece' });
    component.onFilterChange({ key: 'status', value: 'inactive' });
    component.onFilterChange({ key: 'sort', value: 'cost_asc' });

    expect(component.filteredItems()).toEqual([inactiveItem]);

    component.resetFilters();
    expect(component.searchTerm()).toBe('');
    expect(component.statusFilter()).toBe('active');
  });

  it('loads detail state and missing item errors', async () => {
    await component.loadCatalogItemDetail(testCatalogItem.item_id);
    expect(component.item()).toEqual(testCatalogItem);

    repository.getCatalogItemById.and.resolveTo(null);
    await component.loadCatalogItemDetail('missing');
    expect(component.item()).toBeNull();
    expect(component.detailError()).toBe('We could not find this catalog item.');
  });

  it('routes through ngOnInit for list and detail views', async () => {
    component.ngOnInit();
    await flushCrmPromises();
    expect(repository.getCatalogItems).toHaveBeenCalled();

    routeParams.next(new Map([['itemId', testCatalogItem.item_id]]) as never);
    await flushCrmPromises();
    expect(repository.getCatalogItemById).toHaveBeenCalledWith(testCatalogItem.item_id);
  });

  it('creates and updates catalog items with toast and navigation feedback', async () => {
    service.createCatalogItem.and.resolveTo(testCatalogItem);
    service.updateCatalogItem.and.resolveTo(testCatalogItem);
    component.createModalOpen.set(true);

    await component.createItem({
      name: 'Garden Rose',
      item_type: 'flower',
      unit_type: 'bunch',
      base_unit_cost: 30,
      is_active: true,
    });

    expect(component.createModalOpen()).toBeFalse();
    expectToast(toast, 'Catalog item created successfully.');
    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/catalog-items',
      testCatalogItem.item_id,
    ]);

    component.item.set(testCatalogItem);
    component.editModalOpen.set(true);
    await component.saveItemEdits({
      name: 'Garden Rose',
      item_type: 'flower',
      unit_type: 'bunch',
      base_unit_cost: 30,
      is_active: true,
    });

    expect(service.updateCatalogItem).toHaveBeenCalledWith(
      testCatalogItem.item_id,
      jasmine.any(Object)
    );
    expectToast(toast, 'Catalog item updated successfully.');
  });

  it('deactivates, activates, and reports duplicate save failures', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.item.set(testCatalogItem);
    service.deactivateCatalogItem.and.resolveTo({ ...testCatalogItem, is_active: false });
    service.activateCatalogItem.and.resolveTo(testCatalogItem);

    await component.deactivateCurrentItem();
    expect(service.deactivateCatalogItem).toHaveBeenCalledWith(testCatalogItem);
    expectToast(toast, 'Catalog item deactivated.');

    await component.activateCurrentItem();
    expect(service.activateCatalogItem).toHaveBeenCalledWith(testCatalogItem);
    expectToast(toast, 'Catalog item activated.');

    service.createCatalogItem.and.rejectWith({ code: '23505' });
    await component.createItem({
      name: 'Garden Rose',
      item_type: 'flower',
      unit_type: 'bunch',
      base_unit_cost: 30,
      is_active: true,
    });
    expectToast(toast, 'This SKU already exists. Choose a different SKU.', 'error');
  });

  it('formats helper output for catalog item table branches', () => {
    expect(component.formatLabel('base_unit_cost')).toBe('Base Unit Cost');
    expect(component.formatCurrency(12.5)).toBe('$12.50');
    expect(component.formatPackQuantity(testCatalogItem)).toBe('10');
    expect(component.formatPackQuantity({ ...testCatalogItem, unit_type: 'hour' })).toBe('-');
    expect(component.getItemTypeClasses('flower')).toContain('rose');
  });
});
