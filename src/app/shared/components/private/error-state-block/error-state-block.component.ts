import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-error-state-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-state-block.component.html',
  styleUrl: './error-state-block.component.scss',
})
export class ErrorStateBlockComponent {
  @Input() title = 'Something went wrong';
  @Input() description =
    'We were unable to load this content. Please try again.';
  @Input() minHeightClass = 'min-h-[240px]';
  @Input() retryLabel = 'Try Again';
  @Input() showRetry = true;

  @Output() retry = new EventEmitter<void>();
}