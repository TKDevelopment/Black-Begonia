import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';

import { testTaxRegion } from '../../../core/testing/workflow-fixtures';
import {
  createParamMapSubject,
  createRouterSpy,
  createToastSpy,
  expectToast,
  flushCrmPromises,
} from '../../../core/testing/crm-testing';
import { TaxRegionRepositoryService } from '../../../core/supabase/repositories/tax-region-repository.service';
import { TaxRegionService } from '../../../core/supabase/services/tax-region.service';
import { ToastService } from '../../../core/services/toast.service';
import { TaxRegionsComponent } from './tax-regions.component';

describe('TaxRegionsComponent', () => {
  let component: TaxRegionsComponent;
  let fixture: ComponentFixture<TaxRegionsComponent>;
  let routeParams: ReturnType<typeof createParamMapSubject>;
  let router: jasmine.SpyObj<Router>;
  let repository: jasmine.SpyObj<TaxRegionRepositoryService>;
  let service: jasmine.SpyObj<TaxRegionService>;
  let toast: jasmine.SpyObj<ToastService>;

  const inactiveRegion = {
    ...testTaxRegion,
    tax_region_id: 'tax-region-inactive-001',
    name: 'Inactive Tax',
    tax_rate: 0.05,
    is_active: false,
    applies_to_products: false,
    applies_to_services: false,
    applies_to_delivery: false,
    created_at: '2026-06-03T12:00:00.000Z',
  };

  beforeEach(async () => {
    routeParams = createParamMapSubject();
    router = createRouterSpy();
    router.navigate.and.resolveTo(true);
    repository = jasmine.createSpyObj<TaxRegionRepositoryService>(
      'TaxRegionRepositoryService',
      ['getTaxRegions', 'getTaxRegionById']
    );
    service = jasmine.createSpyObj<TaxRegionService>('TaxRegionService', [
      'createTaxRegion',
      'updateTaxRegion',
      'deactivateTaxRegion',
      'activateTaxRegion',
    ]);
    toast = createToastSpy();

    repository.getTaxRegions.and.resolveTo([testTaxRegion, inactiveRegion]);
    repository.getTaxRegionById.and.resolveTo(testTaxRegion);

    await TestBed.configureTestingModule({
      imports: [TaxRegionsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: routeParams.asObservable() } },
        { provide: Router, useValue: router },
        { provide: TaxRegionRepositoryService, useValue: repository },
        { provide: TaxRegionService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    })
      .overrideComponent(TaxRegionsComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(TaxRegionsComponent);
    component = fixture.componentInstance;
  });

  it('loads tax regions and handles empty list results', async () => {
    await component.loadTaxRegions();

    expect(component.loading()).toBeFalse();
    expect(component.taxRegions()).toEqual([testTaxRegion, inactiveRegion]);

    repository.getTaxRegions.and.resolveTo([]);
    await component.loadTaxRegions();
    expect(component.taxRegions()).toEqual([]);
  });

  it('sets a list error when tax region loading fails', async () => {
    spyOn(console, 'error');
    repository.getTaxRegions.and.rejectWith(new Error('tax unavailable'));

    await component.loadTaxRegions();

    expect(component.taxRegions()).toEqual([]);
    expect(component.error()).toBe('We were unable to load tax regions right now.');
  });

  it('filters tax regions by search, status, and sort', () => {
    component.taxRegions.set([testTaxRegion, inactiveRegion]);

    component.onSearchChange('inactive');
    component.onFilterChange({ key: 'status', value: 'inactive' });
    component.onFilterChange({ key: 'sort', value: 'rate_asc' });

    expect(component.filteredTaxRegions()).toEqual([inactiveRegion]);

    component.resetFilters();
    expect(component.searchTerm()).toBe('');
    expect(component.statusFilter()).toBe('active');
  });

  it('loads detail state and missing region errors', async () => {
    await component.loadTaxRegionDetail(testTaxRegion.tax_region_id);
    expect(component.taxRegion()).toEqual(testTaxRegion);

    repository.getTaxRegionById.and.resolveTo(null);
    await component.loadTaxRegionDetail('missing');
    expect(component.taxRegion()).toBeNull();
    expect(component.detailError()).toBe('We could not find this tax region.');
  });

  it('routes through ngOnInit for list and detail views', async () => {
    component.ngOnInit();
    await flushCrmPromises();
    expect(repository.getTaxRegions).toHaveBeenCalled();

    routeParams.next(new Map([['taxRegionId', testTaxRegion.tax_region_id]]) as never);
    await flushCrmPromises();
    expect(repository.getTaxRegionById).toHaveBeenCalledWith(testTaxRegion.tax_region_id);
  });

  it('creates and updates tax regions with toast and navigation feedback', async () => {
    service.createTaxRegion.and.resolveTo(testTaxRegion);
    service.updateTaxRegion.and.resolveTo(testTaxRegion);

    await component.createTaxRegion({
      name: 'Austin Test Tax',
      tax_rate: 0.0825,
      applies_to_products: true,
      applies_to_services: true,
      applies_to_delivery: true,
      is_active: true,
    });

    expectToast(toast, 'Tax region created successfully.');
    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/tax-regions',
      testTaxRegion.tax_region_id,
    ]);

    component.taxRegion.set(testTaxRegion);
    await component.saveTaxRegionEdits({
      name: 'Austin Test Tax',
      tax_rate: 0.0825,
      applies_to_products: true,
      applies_to_services: true,
      applies_to_delivery: true,
      is_active: true,
    });

    expect(service.updateTaxRegion).toHaveBeenCalledWith(
      testTaxRegion.tax_region_id,
      jasmine.any(Object)
    );
    expectToast(toast, 'Tax region updated successfully.');
  });

  it('deactivates, activates, and reports mutation failures', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.taxRegion.set(testTaxRegion);
    service.deactivateTaxRegion.and.resolveTo({ ...testTaxRegion, is_active: false });
    service.activateTaxRegion.and.resolveTo(testTaxRegion);

    await component.deactivateCurrentTaxRegion();
    expect(service.deactivateTaxRegion).toHaveBeenCalledWith(testTaxRegion);
    expectToast(toast, 'Tax region deactivated.');

    await component.activateCurrentTaxRegion();
    expect(service.activateTaxRegion).toHaveBeenCalledWith(testTaxRegion);
    expectToast(toast, 'Tax region activated.');

    service.createTaxRegion.and.rejectWith(new Error('create failed'));
    await component.createTaxRegion({
      name: 'Austin Test Tax',
      tax_rate: 0.0825,
      applies_to_products: true,
      applies_to_services: true,
      applies_to_delivery: true,
      is_active: true,
    });
    expectToast(toast, 'We were unable to create the tax region right now.', 'error');
  });

  it('formats helper output for tax region table branches', () => {
    expect(component.formatPercent(0.0825)).toBe('8.25%');
    expect(component.formatPercent(null)).toBe('0.00%');
    expect(component.getScopeLabel(testTaxRegion)).toBe('Products, Services, Delivery');
    expect(component.getScopeLabel(inactiveRegion)).toBe('No taxable scopes');
  });
});
