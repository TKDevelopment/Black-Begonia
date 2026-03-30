import {
  AfterContentInit,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { EntityTableCellDirective } from './entity-table-cell.directive';

export interface AdminTableColumn {
  key: string;
  label: string;
  className?: string;
  headerClassName?: string;
}

@Component({
  selector: 'app-entity-table-shell',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent],
  templateUrl: './entity-table-shell.component.html',
})
export class EntityTableShellComponent implements AfterContentInit, OnChanges {
  @Input({ required: true }) columns: AdminTableColumn[] = [];
  @Input({ required: true }) rows: any[] = [];

  @Input() loading = false;
  @Input() clickableRows = false;
  @Input() trackByField = 'id';
  @Input() pageSize = 15;

  @Input() emptyTitle = 'No records found';
  @Input() emptyDescription = 'There is nothing to display yet.';

  @Output() rowClick = new EventEmitter<any>();

  @ContentChildren(EntityTableCellDirective)
  cellTemplates!: QueryList<EntityTableCellDirective>;

  private templateMap = new Map<string, EntityTableCellDirective>();
  currentPage = 1;

  ngAfterContentInit(): void {
    this.buildTemplateMap();
    this.cellTemplates.changes.subscribe(() => this.buildTemplateMap());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rows'] && !changes['rows'].firstChange) {
      this.currentPage = 1;
    }

    if (changes['rows'] || changes['pageSize']) {
      this.ensureValidCurrentPage();
    }
  }

  private buildTemplateMap(): void {
    this.templateMap.clear();
    this.cellTemplates.forEach((template) => {
      this.templateMap.set(template.key, template);
    });
  }

  getCellTemplate(key: string): EntityTableCellDirective | undefined {
    return this.templateMap.get(key);
  }

  get totalRows(): number {
    return this.rows?.length ?? 0;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalRows / this.pageSize));
  }

  get paginatedRows(): any[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.rows.slice(startIndex, startIndex + this.pageSize);
  }

  get visiblePageNumbers(): number[] {
    if (this.totalPages <= 7) {
      return Array.from({ length: this.totalPages }, (_, index) => index + 1);
    }

    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);
    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }

  get pageSummaryText(): string {
    return `Page ${this.currentPage} of ${this.totalPages}`;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
  }

  goToPreviousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  goToNextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  onRowClicked(row: any): void {
    if (this.clickableRows) {
      this.rowClick.emit(row);
    }
  }

  private ensureValidCurrentPage(): void {
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  trackByRow = (_index: number, row: any): any => {
    return row?.[this.trackByField] ?? _index;
  };
}
