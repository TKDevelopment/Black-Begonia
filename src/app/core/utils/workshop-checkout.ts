import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Ticket links must be absolute HTTPS URLs without embedded credentials. */
export function isExternalCheckoutUrl(value: string): boolean {
  if (value.length > 2048
    || !/^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^\s\\]*)?$/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function externalCheckoutUrlValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  return !value || isExternalCheckoutUrl(value) ? null : { externalCheckoutUrl: true };
}
