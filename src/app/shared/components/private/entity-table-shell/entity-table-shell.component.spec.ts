import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityTableShellComponent } from './entity-table-shell.component';

describe('EntityTableShellComponent', () => {
  let component: EntityTableShellComponent;
  let fixture: ComponentFixture<EntityTableShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityTableShellComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityTableShellComponent);
    component = fixture.componentInstance;
    component.columns = [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
    ];
    component.rows = [
      { id: 'row-1', name: 'Avery', status: 'new' },
      { id: 'row-2', name: 'Jordan', status: 'contacted' },
      { id: 'row-3', name: 'Morgan', status: 'converted' },
    ];
    component.pageSize = 2;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should paginate rows and expose page summary text', () => {
    expect(component.totalRows).toBe(3);
    expect(component.totalPages).toBe(2);
    expect(component.paginatedRows.map((row) => row.id)).toEqual(['row-1', 'row-2']);
    expect(component.pageSummaryText).toBe('Page 1 of 2');

    component.goToNextPage();

    expect(component.currentPage).toBe(2);
    expect(component.paginatedRows.map((row) => row.id)).toEqual(['row-3']);
  });

  it('should emit row clicks only when rows are clickable', () => {
    const row = component.rows[0];
    const emitted: unknown[] = [];
    component.rowClick.subscribe((value) => emitted.push(value));

    component.onRowClicked(row);
    expect(emitted).toEqual([]);

    component.clickableRows = true;
    component.onRowClicked(row);
    expect(emitted).toEqual([row]);
  });
});
