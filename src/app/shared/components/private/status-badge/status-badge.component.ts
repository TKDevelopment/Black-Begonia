import { CommonModule, NgClass } from '@angular/common';
import { Component, Input } from '@angular/core'; // adjust path if needed
import { LeadStatus } from '../../../../core/models/lead-status';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
})
export class StatusBadgeComponent {
  @Input({ required: true }) label!: string | LeadStatus;

  @Input() tone:
    | 'neutral'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'purple' = 'neutral';

  @Input() size: 'sm' | 'md' = 'sm';

  @Input() pill = true;

  get formattedLabel(): string {
    if (!this.label) return '';

    return String(this.label)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char: string) => char.toUpperCase());
  }

  get classes(): string {
    const base =
      'inline-flex items-center border font-medium whitespace-nowrap';

    const sizeMap = {
      sm: 'px-2.5 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
    };

    const toneMap = {
      neutral: 'bg-stone-100 text-stone-700 border-stone-200',
      info: 'bg-blue-100 text-blue-700 border-blue-200',
      success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      warning: 'bg-amber-100 text-amber-700 border-amber-200',
      danger: 'bg-rose-100 text-rose-700 border-rose-200',
      purple: 'bg-purple-100 text-purple-700 border-purple-200',
    };

    const radius = this.pill ? 'rounded-full' : 'rounded-lg';

    return `${base} ${sizeMap[this.size]} ${toneMap[this.tone]} ${radius}`;
  }
}