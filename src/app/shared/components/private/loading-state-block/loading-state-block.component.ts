import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-state-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-state-block.component.html',
  styleUrl: './loading-state-block.component.scss',
})
export class LoadingStateBlockComponent {
  @Input() title = 'Loading...';
  @Input() description = 'Please wait while we load this content.';
  @Input() minHeightClass = 'min-h-[240px]';
  @Input() fullWidth = true;
}