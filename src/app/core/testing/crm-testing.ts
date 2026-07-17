import { convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ToastService, ToastType } from '../services/toast.service';

export function createParamMapSubject(initialParams: Record<string, string | null> = {}) {
  return new BehaviorSubject<ParamMap>(convertToParamMap(initialParams));
}

export function createRouterSpy(): jasmine.SpyObj<Router> {
  return jasmine.createSpyObj<Router>('Router', ['navigate']);
}

export function createToastSpy(): jasmine.SpyObj<ToastService> {
  return jasmine.createSpyObj<ToastService>('ToastService', ['showToast']);
}

export async function flushCrmPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export function expectToast(
  toast: jasmine.SpyObj<ToastService>,
  message: string,
  tone: ToastType = 'success'
): void {
  expect(toast.showToast).toHaveBeenCalledWith(message, tone);
}

export function expectTableState(
  loading: boolean,
  error: string | null | undefined,
  rowCount: number
): void {
  expect(loading).toBeFalse();
  expect(error ?? null).toBeNull();
  expect(rowCount).toBeGreaterThanOrEqual(0);
}

export function expectEmptyState(items: readonly unknown[]): void {
  expect(items.length).toBe(0);
}

export function expectModalClosed(
  open: boolean,
  mode?: string,
  selectedRecord?: unknown
): void {
  expect(open).toBeFalse();
  if (mode !== undefined) {
    expect(mode).toBe('create');
  }
  if (selectedRecord !== undefined) {
    expect(selectedRecord).toBeNull();
  }
}

export function expectModalEmit<T>(
  emitter: jasmine.Spy<(payload: T) => void>,
  expected: jasmine.Expected<T>
): void {
  expect(emitter).toHaveBeenCalledWith(expected);
}
