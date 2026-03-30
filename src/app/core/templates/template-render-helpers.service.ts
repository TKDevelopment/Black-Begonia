import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TemplateRenderHelpersService {
  formatCurrency(value: number | null | undefined, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value ?? 0);
  }

  formatDate(
    value: string | null | undefined,
    format: 'long' | 'short' = 'long'
  ): string {
    if (!value) return '';

    return new Intl.DateTimeFormat('en-US', {
      month: format === 'long' ? 'long' : 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatPhone(value: string | null | undefined): string {
    if (!value) return '';

    const digits = value.replace(/\D/g, '');
    if (digits.length !== 10) return value;

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  uppercase(value: string | null | undefined): string {
    return (value ?? '').toUpperCase();
  }

  titlecase(value: string | null | undefined): string {
    return (value ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  hasValue(value: unknown): boolean {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  isEmpty(value: unknown): boolean {
    return !this.hasValue(value);
  }

  eq(a: unknown, b: unknown): boolean {
    return a === b;
  }

  includes(list: unknown[] | null | undefined, value: unknown): boolean {
    return Array.isArray(list) ? list.includes(value) : false;
  }

  first<T>(items: T[] | null | undefined): T | null {
    return Array.isArray(items) && items.length > 0 ? items[0] : null;
  }

  limit<T>(items: T[] | null | undefined, count: number): T[] {
    return Array.isArray(items) ? items.slice(0, count) : [];
  }

  count(items: unknown[] | null | undefined): number {
    return Array.isArray(items) ? items.length : 0;
  }
}
