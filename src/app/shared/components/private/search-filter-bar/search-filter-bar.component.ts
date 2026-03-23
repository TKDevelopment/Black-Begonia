import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface SearchFilterOption {
  label: string;
  value: string;
}

export interface SearchFilterGroup {
  key: string;
  label: string;
  value: string;
  options: SearchFilterOption[];
}

@Component({
  selector: 'app-search-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-filter-bar.component.html',
})
export class SearchFilterBarComponent {
  @Input() searchPlaceholder = 'Search...';
  @Input() searchValue = '';
  @Input() filters: SearchFilterGroup[] = [];
  @Input() showReset = true;

  @Output() searchChange = new EventEmitter<string>();
  @Output() filterChange = new EventEmitter<{ key: string; value: string }>();
  @Output() reset = new EventEmitter<void>();

  onSearchInput(value: string): void {
    this.searchChange.emit(value);
  }

  onFilterSelect(key: string, value: string): void {
    this.filterChange.emit({ key, value });
  }
}