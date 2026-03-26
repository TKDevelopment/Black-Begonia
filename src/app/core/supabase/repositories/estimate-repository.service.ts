import { Injectable } from '@angular/core';
import {
  Estimate,
  EstimateLineItem,
  EstimateLineItemComponentSnapshot,
  ShoppingList,
  ShoppingListItem,
} from '../../models/estimate';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class EstimateRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly estimateSelect = `
    estimate_id,
    lead_id,
    version,
    is_active,
    status,
    tax_region_id,
    subtotal,
    discount_total,
    fee_total,
    tax_total,
    grand_total,
    terms_version,
    privacy_policy_version,
    accepted_terms,
    accepted_privacy_policy,
    accepted_at,
    declined_at,
    signed_at,
    signature_name,
    signature_ip,
    signature_user_agent,
    estimate_pdf_storage_path,
    created_at,
    updated_at,
    tax_region:tax_regions (
      tax_region_id,
      name,
      authority_name,
      tax_rate,
      applies_to_products,
      applies_to_services,
      applies_to_delivery,
      is_active
    )
  `;

  private readonly lineItemSelect = `
    estimate_line_item_id,
    estimate_id,
    arrangement_id,
    line_type,
    name,
    description,
    quantity,
    unit_price,
    line_subtotal,
    pricing_snapshot,
    display_order,
    created_at,
    updated_at,
    arrangement:arrangements (
      arrangement_id,
      name,
      category,
      suggested_sell_price,
      manual_override_sell_price
    )
  `;

  private normalizeEstimate(row: any): Estimate {
    return {
      ...row,
      tax_region: Array.isArray(row?.tax_region) ? (row.tax_region[0] ?? null) : (row?.tax_region ?? null),
    } as Estimate;
  }

  private normalizeLineItem(row: any): EstimateLineItem {
    return {
      ...row,
      arrangement: Array.isArray(row?.arrangement) ? (row.arrangement[0] ?? null) : (row?.arrangement ?? null),
    } as EstimateLineItem;
  }

  async getActiveEstimateForLead(leadId: string): Promise<Estimate | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('estimates')
      .select(this.estimateSelect)
      .eq('lead_id', leadId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[EstimateRepositoryService] getActiveEstimateForLead error:', error);
      return null;
    }

    return data ? this.normalizeEstimate(data) : null;
  }

  async getLeadEstimates(leadId: string): Promise<Estimate[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('estimates')
      .select(this.estimateSelect)
      .eq('lead_id', leadId)
      .order('version', { ascending: false });

    if (error) {
      console.error('[EstimateRepositoryService] getLeadEstimates error:', error);
      return [];
    }

    return (data ?? []).map((row) => this.normalizeEstimate(row));
  }

  async createEstimate(payload: Partial<Estimate> & { lead_id: string; version: number; terms_version: string; privacy_policy_version: string; }): Promise<Estimate> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('estimates')
      .insert({
        lead_id: payload.lead_id,
        version: payload.version,
        is_active: payload.is_active ?? true,
        status: payload.status ?? 'draft',
        tax_region_id: payload.tax_region_id ?? null,
        subtotal: payload.subtotal ?? 0,
        discount_total: payload.discount_total ?? 0,
        fee_total: payload.fee_total ?? 0,
        tax_total: payload.tax_total ?? 0,
        grand_total: payload.grand_total ?? 0,
        terms_version: payload.terms_version,
        privacy_policy_version: payload.privacy_policy_version,
        accepted_terms: payload.accepted_terms ?? false,
        accepted_privacy_policy: payload.accepted_privacy_policy ?? false,
        estimate_pdf_storage_path: payload.estimate_pdf_storage_path ?? null,
      })
      .select(this.estimateSelect)
      .single();

    if (error) {
      console.error('[EstimateRepositoryService] createEstimate error:', error);
      throw error;
    }

    return this.normalizeEstimate(data);
  }

  async updateEstimate(estimateId: string, updates: Partial<Estimate>): Promise<Estimate> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('estimates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('estimate_id', estimateId)
      .select(this.estimateSelect)
      .single();

    if (error) {
      console.error('[EstimateRepositoryService] updateEstimate error:', error);
      throw error;
    }

    return this.normalizeEstimate(data);
  }

  async getEstimateLineItems(estimateId: string): Promise<EstimateLineItem[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('estimate_line_items')
      .select(this.lineItemSelect)
      .eq('estimate_id', estimateId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[EstimateRepositoryService] getEstimateLineItems error:', error);
      return [];
    }

    return (data ?? []).map((row) => this.normalizeLineItem(row));
  }

  async replaceEstimateLineItems(estimateId: string, lineItems: Partial<EstimateLineItem>[]): Promise<EstimateLineItem[]> {
    await this.supabaseService.getClient().from('estimate_line_items').delete().eq('estimate_id', estimateId);

    if (!lineItems.length) {
      return [];
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('estimate_line_items')
      .insert(
        lineItems.map((item, index) => ({
          estimate_id: estimateId,
          arrangement_id: item.arrangement_id ?? null,
          line_type: item.line_type ?? 'arrangement',
          name: item.name,
          description: item.description ?? null,
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price ?? 0,
          line_subtotal: item.line_subtotal ?? 0,
          pricing_snapshot: item.pricing_snapshot ?? {},
          display_order: item.display_order ?? index,
        }))
      )
      .select(this.lineItemSelect)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[EstimateRepositoryService] replaceEstimateLineItems error:', error);
      throw error;
    }

    return (data ?? []).map((row) => this.normalizeLineItem(row));
  }

  async replaceLineItemComponentSnapshots(estimateId: string, lineItems: EstimateLineItem[], snapshots: EstimateLineItemComponentSnapshot[][]): Promise<void> {
    if (lineItems.length) {
      await this.supabaseService
        .getClient()
        .from('estimate_line_item_components')
        .delete()
        .in('estimate_line_item_id', lineItems.map((item) => item.estimate_line_item_id));
    }

    const rows = lineItems.flatMap((lineItem, index) =>
      (snapshots[index] ?? []).map((snapshot) => ({
        estimate_line_item_id: lineItem.estimate_line_item_id,
        item_id: snapshot.item_id ?? null,
        item_name: snapshot.item_name,
        item_type: snapshot.item_type,
        unit_type: snapshot.unit_type,
        color: snapshot.color ?? null,
        variety: snapshot.variety ?? null,
        quantity_per_arrangement: snapshot.quantity_per_arrangement,
        arrangement_quantity: snapshot.arrangement_quantity,
        extended_quantity: snapshot.extended_quantity,
        waste_percent: snapshot.waste_percent,
        extended_quantity_with_waste: snapshot.extended_quantity_with_waste,
        unit_cost: snapshot.unit_cost,
        extended_cost: snapshot.extended_cost,
      }))
    );

    if (!rows.length) return;

    const { error } = await this.supabaseService
      .getClient()
      .from('estimate_line_item_components')
      .insert(rows);

    if (error) {
      console.error('[EstimateRepositoryService] replaceLineItemComponentSnapshots error:', error);
      throw error;
    }
  }

  async upsertShoppingList(estimateId: string, items: ShoppingListItem[]): Promise<ShoppingList> {
    const existing = await this.supabaseService
      .getClient()
      .from('shopping_lists')
      .select('shopping_list_id, estimate_id, status, generated_at, exported_at, created_at, updated_at')
      .eq('estimate_id', estimateId)
      .maybeSingle();

    let shoppingList: ShoppingList;

    if (existing.error) {
      console.error('[EstimateRepositoryService] upsertShoppingList fetch error:', existing.error);
      throw existing.error;
    }

    if (existing.data) {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('shopping_lists')
        .update({
          status: 'generated',
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('shopping_list_id', existing.data.shopping_list_id)
        .select('*')
        .single();

      if (error) {
        console.error('[EstimateRepositoryService] upsertShoppingList update error:', error);
        throw error;
      }

      shoppingList = data as ShoppingList;
    } else {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('shopping_lists')
        .insert({
          estimate_id: estimateId,
          status: 'generated',
        })
        .select('*')
        .single();

      if (error) {
        console.error('[EstimateRepositoryService] upsertShoppingList insert error:', error);
        throw error;
      }

      shoppingList = data as ShoppingList;
    }

    await this.supabaseService
      .getClient()
      .from('shopping_list_items')
      .delete()
      .eq('shopping_list_id', shoppingList.shopping_list_id);

    if (items.length) {
      const { error } = await this.supabaseService
        .getClient()
        .from('shopping_list_items')
        .insert(items.map((item) => ({ ...item, shopping_list_id: shoppingList.shopping_list_id })));

      if (error) {
        console.error('[EstimateRepositoryService] upsertShoppingList items error:', error);
        throw error;
      }
    }

    return shoppingList;
  }
}
