import { Injectable, signal } from '@angular/core';

export type CrmThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class CrmThemeService {
  private readonly storageKey = 'bb-crm-theme';

  readonly mode = signal<CrmThemeMode>('light');

  constructor() {
    this.initialize();
  }

  get isDarkMode(): boolean {
    return this.mode() === 'dark';
  }

  setMode(mode: CrmThemeMode): void {
    this.mode.set(mode);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.storageKey, mode);
    }
  }

  toggle(): void {
    this.setMode(this.isDarkMode ? 'light' : 'dark');
  }

  private initialize(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const saved = window.localStorage.getItem(this.storageKey);

    if (saved === 'light' || saved === 'dark') {
      this.mode.set(saved);
      return;
    }

    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.mode.set(prefersDark ? 'dark' : 'light');
  }
}
