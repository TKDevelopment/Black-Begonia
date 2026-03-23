import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-crm-page-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './crm-page-header.component.html',
})
export class CrmPageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;

  @Input() primaryActionLabel?: string;
  @Input() secondaryActionLabel?: string;

  @Input() primaryDisabled = false;
  @Input() secondaryDisabled = false;

  @Output() primaryAction = new EventEmitter<void>();
  @Output() secondaryAction = new EventEmitter<void>();
}