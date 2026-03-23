import {
  AfterContentInit,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  Output,
  QueryList,
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
export class EntityTableShellComponent implements AfterContentInit {
  @Input({ required: true }) columns: AdminTableColumn[] = [];
  @Input({ required: true }) rows: any[] = [];

  @Input() loading = false;
  @Input() clickableRows = false;
  @Input() trackByField = 'id';

  @Input() emptyTitle = 'No records found';
  @Input() emptyDescription = 'There is nothing to display yet.';

  @Output() rowClick = new EventEmitter<any>();

  @ContentChildren(EntityTableCellDirective)
  cellTemplates!: QueryList<EntityTableCellDirective>;

  private templateMap = new Map<string, EntityTableCellDirective>();

  ngAfterContentInit(): void {
    this.buildTemplateMap();
    this.cellTemplates.changes.subscribe(() => this.buildTemplateMap());
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

  onRowClicked(row: any): void {
    console.log("OnRowClicked");
    if (this.clickableRows) {
      this.rowClick.emit(row);
      console.log("Clickable row: ", row);
    }
  }

  trackByRow = (_index: number, row: any): any => {
    return row?.[this.trackByField] ?? _index;
  };
}