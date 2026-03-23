import { CommonModule, Location } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

@Component({
  selector: 'app-entity-detail-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './entity-detail-shell.component.html',
})
export class EntityDetailShellComponent {
  private location = inject(Location);

  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() backLabel = 'Back';
  @Input() loading = false;
  @Input() useBrowserBack = false;

  @Output() back = new EventEmitter<void>();

  onBack(): void {
    if (this.useBrowserBack) {
      this.location.back();
      return;
    }

    this.back.emit();
  }
}