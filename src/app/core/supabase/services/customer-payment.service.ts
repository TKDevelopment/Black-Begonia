import { Injectable } from '@angular/core';
import { CheckoutHandoff, CustomerPaymentProjection, PaymentMethodChoice } from '../../models/payment-request';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({ providedIn: 'root' })
export class CustomerPaymentService {
  private paypalSdkPromise: Promise<void> | null = null;
  constructor(private readonly supabase: SupabaseService) {}

  async resolve(token: string, attempt?: string | null): Promise<CustomerPaymentProjection> {
    const { data, error } = await this.supabase.getClient().functions.invoke('resolve-payment-request', { body: { token, attempt: attempt ?? null } });
    if (error) return { state: 'unavailable' };
    return this.normalize(data);
  }

  async choose(token: string, method: PaymentMethodChoice): Promise<CheckoutHandoff> {
    const { data, error } = await this.supabase.getClient().functions.invoke('create-payment-checkout', { body: { token, method } });
    if (error) throw new Error(error.message || 'Payment option is temporarily unavailable.');
    return data as CheckoutHandoff;
  }

  async captureVenmo(token: string, attempt: string): Promise<CustomerPaymentProjection> {
    const { error } = await this.supabase.getClient().functions.invoke('capture-venmo-order', { body: { token, attempt } });
    if (error) throw new Error('Venmo capture could not be confirmed.');
    return this.resolve(token, attempt);
  }

  async poll(token: string, attempt: string | null, maxAttempts = 8, intervalMs = 1500): Promise<CustomerPaymentProjection> {
    let state = await this.resolve(token, attempt);
    for (let index = 1; index < maxAttempts && state.state === 'processing'; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      state = await this.resolve(token, attempt);
    }
    return state;
  }

  loadPayPalSdk(clientId: string): Promise<void> {
    if (typeof document === 'undefined' || (globalThis as any).paypal) return Promise.resolve();
    if (this.paypalSdkPromise) return this.paypalSdkPromise;
    this.paypalSdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&components=buttons&enable-funding=venmo`;
      script.async = true; script.onload = () => resolve(); script.onerror = () => reject(new Error('Venmo could not be loaded.'));
      document.head.appendChild(script);
    });
    return this.paypalSdkPromise;
  }

  private normalize(value: any): CustomerPaymentProjection {
    if (!value || !['active', 'processing', 'confirmed', 'still_outstanding', 'unavailable'].includes(value.state)) return { state: 'unavailable' };
    return { ...value, principalCents: value.principalCents == null ? undefined : Number(value.principalCents), depositCents: value.depositCents == null ? undefined : Number(value.depositCents), finalCents: value.finalCents == null ? undefined : Number(value.finalCents) } as CustomerPaymentProjection;
  }
}
