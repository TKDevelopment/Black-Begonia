import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

type EmptyStateIcon = 'inbox' | 'search' | 'tasks' | 'contacts' | 'projects';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-state.component.html',
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() actionLabel?: string;
  @Input() icon: EmptyStateIcon = 'inbox';

  @Output() action = new EventEmitter<void>();
}