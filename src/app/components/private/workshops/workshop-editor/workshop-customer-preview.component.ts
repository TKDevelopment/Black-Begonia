import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { WorkshopMedia } from '../../../../core/models/workshop';

@Component({
  selector: 'app-workshop-customer-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workshop-customer-preview.component.html',
  styleUrl: './workshop-customer-preview.component.scss',
})
export class WorkshopCustomerPreviewComponent {
  @Input() title = '';
  @Input() theme = '';
  @Input() advertisingLine = '';
  @Input() description = '';
  @Input() includedMaterials = '';
  @Input() venueName = '';
  @Input() locality = '';
  @Input() region = '';
  @Input() priceMajor = 0;
  @Input() dateLabel = 'Date not set';
  @Input() timeLabel = 'Time not set';
  @Input() hero: WorkshopMedia | null = null;
  @Input() gallery: WorkshopMedia[] = [];
  @Output() readonly closed = new EventEmitter<void>();
}
