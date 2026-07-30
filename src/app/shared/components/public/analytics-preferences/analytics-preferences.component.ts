import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AnalyticsPreferenceService } from '../../../../core/analytics/analytics-preference.service';
import { AnalyticsRuntimeState } from '../../../../core/analytics/analytics.models';
import { WebsiteAnalyticsService } from '../../../../core/analytics/website-analytics.service';

@Component({
  selector: 'app-analytics-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './analytics-preferences.component.html',
  styleUrl: './analytics-preferences.component.scss',
})
export class AnalyticsPreferencesComponent implements AfterViewChecked, OnDestroy {
  private readonly preferences = inject(AnalyticsPreferenceService);
  private readonly analytics = inject(WebsiteAnalyticsService);
  private readonly subscriptions = new Subscription();
  private restoreFocusTo: HTMLElement | null = null;
  private focusDialog = false;

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  @ViewChild('dialogPanel') dialogPanel?: ElementRef<HTMLElement>;

  state: AnalyticsRuntimeState = this.analytics.state;
  choice = this.preferences.getChoice();
  internalBrowser = this.preferences.isInternalBrowser();
  readonly gpcEnabled = this.preferences.browserGpcEnabled();
  storageError = false;

  constructor() {
    this.subscriptions.add(
      this.analytics.state$.subscribe((state) => {
        this.state = state;
      })
    );
    this.subscriptions.add(
      this.preferences.changes$.subscribe(() => {
        this.choice = this.preferences.getChoice();
        this.internalBrowser = this.preferences.isInternalBrowser();
      })
    );
  }

  get showInitialNotice(): boolean {
    return !this.open && !this.choice && !this.internalBrowser && !this.gpcEnabled &&
      (this.state === 'enabled' || this.state === 'awaiting_opt_in');
  }

  get requiresOptIn(): boolean {
    return this.state === 'awaiting_opt_in';
  }

  ngAfterViewChecked(): void {
    if (this.open && !this.focusDialog) {
      this.restoreFocusTo = document.activeElement as HTMLElement | null;
      this.focusDialog = true;
      queueMicrotask(() => this.dialogPanel?.nativeElement.focus());
    } else if (!this.open) {
      this.focusDialog = false;
    }
  }

  enable(): void {
    this.storageError = !this.preferences.setChoice('enabled');
  }

  disable(): void {
    this.storageError = !this.preferences.setChoice('disabled');
  }

  setInternalBrowser(excluded: boolean): void {
    this.storageError = !this.preferences.setInternalBrowser(excluded);
  }

  close(): void {
    this.closed.emit();
    queueMicrotask(() => this.restoreFocusTo?.focus());
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
