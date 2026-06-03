import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { SearchFilterBarComponent } from './search-filter-bar.component';

describe('SearchFilterBarComponent', () => {
  let component: SearchFilterBarComponent;
  let fixture: ComponentFixture<SearchFilterBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchFilterBarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchFilterBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit search changes from the input handler', () => {
    const emitted: string[] = [];
    component.searchChange.subscribe((value) => emitted.push(value));

    component.onSearchInput('orchid');

    expect(emitted).toEqual(['orchid']);
  });

  it('should emit filter changes with the filter key and selected value', () => {
    const emitted: Array<{ key: string; value: string }> = [];
    component.filterChange.subscribe((value) => emitted.push(value));

    component.onFilterSelect('status', 'active');

    expect(emitted).toEqual([{ key: 'status', value: 'active' }]);
  });

  it('should render configured filters and reset action', () => {
    component.filters = [
      {
        key: 'status',
        label: 'Status',
        value: 'active',
        options: [
          { label: 'All', value: 'all' },
          { label: 'Active', value: 'active' },
        ],
      },
    ];
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Status');
    expect(fixture.debugElement.query(By.css('select'))).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button')?.textContent).toContain('Reset');
  });

  it('should hide reset when reset is disabled', () => {
    component.showReset = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
