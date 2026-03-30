import { Injectable } from '@angular/core';

import {
  CreateFloralProposalInput,
  FloralProposal,
  FloralProposalComponent,
  FloralProposalLineItem,
  FloralProposalShoppingList,
  FloralProposalShoppingListItem,
} from '../../models/floral-proposal';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class FloralProposalRepositoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private normalizeProposal(row: any): FloralProposal {
    const template = Array.isArray(row?.template)
      ? row.template[0] ?? null
      : row?.template ?? null;

    return {
      ...row,
      template,
    } as FloralProposal;
  }

  private readonly proposalSelect = `
    floral_proposal_id,
    lead_id,
    template_id,
    tax_region_id,
    version,
    is_active,
    status,
    customer_email,
    pdf_storage_path,
    pdf_url,
    subtotal,
    tax_rate,
    tax_amount,
    total_amount,
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
    decline_feedback,
    snapshot,
    created_by,
    created_at,
    updated_at,
    template:document_templates (
      template_id,
      name,
      template_key,
      template_kind,
      is_active,
      header_content,
      footer_content,
      body_config,
      created_at,
      updated_at
    )
  `;

  private readonly lineItemSelect = `
    floral_proposal_line_item_id,
    floral_proposal_id,
    display_order,
    line_item_type,
    item_name,
    quantity,
    unit_price,
    subtotal,
    image_storage_path,
    image_alt_text,
    image_caption,
    snapshot,
    created_at,
    updated_at
  `;

  private readonly componentSelect = `
    floral_proposal_component_id,
    floral_proposal_line_item_id,
    display_order,
    catalog_item_id,
    catalog_item_name,
    quantity_per_unit,
    extended_quantity,
    base_unit_cost,
    applied_markup_percent,
    sell_unit_price,
    subtotal,
    reserve_percent,
    snapshot,
    created_at,
    updated_at
  `;

  async getAllProposals(): Promise<FloralProposal[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('floral_proposals')
      .select(this.proposalSelect)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(
        '[FloralProposalRepositoryService] getAllProposals error:',
        error
      );
      return [];
    }

    return (data ?? []).map((row) => this.normalizeProposal(row));
  }
  async getLeadFloralProposals(leadId: string): Promise<FloralProposal[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('floral_proposals')
      .select(this.proposalSelect)
      .eq('lead_id', leadId)
      .order('version', { ascending: false });

    if (error) {
      console.error(
        '[FloralProposalRepositoryService] getLeadFloralProposals error:',
        error
      );
      return [];
    }

    return (data ?? []).map((row) => this.normalizeProposal(row));
  }

  async getFloralProposalById(
    floralProposalId: string
  ): Promise<FloralProposal | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('floral_proposals')
      .select(this.proposalSelect)
      .eq('floral_proposal_id', floralProposalId)
      .maybeSingle();

    if (error) {
      console.error(
        '[FloralProposalRepositoryService] getFloralProposalById error:',
        error
      );
      return null;
    }

    return data ? this.normalizeProposal(data) : null;
  }

  async getActiveLeadFloralProposal(leadId: string): Promise<FloralProposal | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('floral_proposals')
      .select(this.proposalSelect)
      .eq('lead_id', leadId)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        '[FloralProposalRepositoryService] getActiveLeadFloralProposal error:',
        error
      );
      return null;
    }

    return data ? this.normalizeProposal(data) : null;
  }

  async getFloralProposalLineItems(
    floralProposalId: string
  ): Promise<FloralProposalLineItem[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('floral_proposal_line_items')
      .select(this.lineItemSelect)
      .eq('floral_proposal_id', floralProposalId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error(
        '[FloralProposalRepositoryService] getFloralProposalLineItems error:',
        error
      );
      return [];
    }

    return (data ?? []) as FloralProposalLineItem[];
  }

  async getFloralProposalComponents(
    floralProposalId: string
  ): Promise<FloralProposalComponent[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('floral_proposal_components')
      .select(
        `
          ${this.componentSelect},
          floral_proposal_line_items!inner (
            floral_proposal_id
          )
        `
      )
      .eq('floral_proposal_line_items.floral_proposal_id', floralProposalId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error(
        '[FloralProposalRepositoryService] getFloralProposalComponents error:',
        error
      );
      return [];
    }

    return (data ?? []).map((row: any) => {
      const { floral_proposal_line_items, ...component } = row;
      return component as FloralProposalComponent;
    });
  }

  async createFloralProposal(
    payload: CreateFloralProposalInput
  ): Promise<FloralProposal> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('floral_proposals')
      .insert({
        lead_id: payload.lead_id,
        template_id: payload.template_id ?? null,
        tax_region_id: payload.tax_region_id ?? null,
        version: payload.version,
        is_active: payload.is_active ?? true,
        status: payload.status ?? 'draft',
        customer_email: payload.customer_email,
        passcode_hash: payload.passcode_hash,
        pdf_storage_path: payload.pdf_storage_path ?? null,
        pdf_url: payload.pdf_url ?? null,
        subtotal: payload.subtotal,
        tax_rate: payload.tax_rate,
        tax_amount: payload.tax_amount,
        total_amount: payload.total_amount,
        terms_version: payload.terms_version ?? 'v1',
        privacy_policy_version: payload.privacy_policy_version ?? 'v1',
        snapshot: payload.snapshot ?? {},
        created_by: payload.created_by ?? null,
      })
      .select(this.proposalSelect)
      .single();

    if (error) {
      console.error(
        '[FloralProposalRepositoryService] createFloralProposal error:',
        error
      );
      throw error;
    }

    return this.normalizeProposal(data);
  }

  async updateFloralProposal(
    floralProposalId: string,
    updates: Partial<FloralProposal>
  ): Promise<FloralProposal> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('floral_proposals')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('floral_proposal_id', floralProposalId)
      .select(this.proposalSelect)
      .single();

    if (error) {
      console.error(
        '[FloralProposalRepositoryService] updateFloralProposal error:',
        error
      );
      throw error;
    }

    return this.normalizeProposal(data);
  }

  async replaceFloralProposalLineItems(
    floralProposalId: string,
    lineItems: Omit<
      FloralProposalLineItem,
      'floral_proposal_line_item_id' | 'floral_proposal_id' | 'created_at' | 'updated_at'
    >[]
  ): Promise<FloralProposalLineItem[]> {
    const client = this.supabaseService.getClient();

    const { error: deleteError } = await client
      .from('floral_proposal_line_items')
      .delete()
      .eq('floral_proposal_id', floralProposalId);

    if (deleteError) {
      console.error(
        '[FloralProposalRepositoryService] replaceFloralProposalLineItems delete error:',
        deleteError
      );
      throw deleteError;
    }

    if (!lineItems.length) {
      return [];
    }

    const { data, error } = await client
      .from('floral_proposal_line_items')
      .insert(
        lineItems.map((lineItem) => ({
          floral_proposal_id: floralProposalId,
          display_order: lineItem.display_order,
          line_item_type: lineItem.line_item_type,
          item_name: lineItem.item_name,
          quantity: lineItem.quantity,
          unit_price: lineItem.unit_price,
          subtotal: lineItem.subtotal,
          image_storage_path: lineItem.image_storage_path ?? null,
          image_alt_text: lineItem.image_alt_text ?? null,
          image_caption: lineItem.image_caption ?? null,
          snapshot: lineItem.snapshot ?? {},
        }))
      )
      .select(this.lineItemSelect)
      .order('display_order', { ascending: true });

    if (error) {
      console.error(
        '[FloralProposalRepositoryService] replaceFloralProposalLineItems insert error:',
        error
      );
      throw error;
    }

    return (data ?? []) as FloralProposalLineItem[];
  }

  async replaceFloralProposalComponents(
    lineItems: FloralProposalLineItem[],
    componentsByLineItemId: Record<string, FloralProposalComponent[]>
  ): Promise<void> {
    const client = this.supabaseService.getClient();
    const lineItemIds = lineItems.map((lineItem) => lineItem.floral_proposal_line_item_id);

    if (lineItemIds.length) {
      const { error: deleteError } = await client
        .from('floral_proposal_components')
        .delete()
        .in('floral_proposal_line_item_id', lineItemIds);

      if (deleteError) {
        console.error(
          '[FloralProposalRepositoryService] replaceFloralProposalComponents delete error:',
          deleteError
        );
        throw deleteError;
      }
    }

    const rows = lineItems.flatMap((lineItem) =>
      (componentsByLineItemId[lineItem.floral_proposal_line_item_id] ?? []).map(
        (component, index) => ({
          floral_proposal_line_item_id: lineItem.floral_proposal_line_item_id,
          display_order: component.display_order ?? index,
          catalog_item_id: component.catalog_item_id ?? null,
          catalog_item_name: component.catalog_item_name,
          quantity_per_unit: component.quantity_per_unit,
          extended_quantity: component.extended_quantity,
          base_unit_cost: component.base_unit_cost,
          applied_markup_percent: component.applied_markup_percent,
          sell_unit_price: component.sell_unit_price,
          subtotal: component.subtotal,
          reserve_percent: component.reserve_percent ?? 0,
          snapshot: component.snapshot ?? {},
        })
      )
    );

    if (!rows.length) {
      return;
    }

    const { error } = await client.from('floral_proposal_components').insert(rows);

    if (error) {
      console.error(
        '[FloralProposalRepositoryService] replaceFloralProposalComponents insert error:',
        error
      );
      throw error;
    }
  }

  async upsertShoppingList(
    floralProposalId: string,
    items: FloralProposalShoppingListItem[]
  ): Promise<FloralProposalShoppingList | null> {
    const client = this.supabaseService.getClient();

    const { data: existing, error: existingError } = await client
      .from('floral_proposal_shopping_lists')
      .select(
        `
          floral_proposal_shopping_list_id,
          floral_proposal_id,
          status,
          generated_at,
          exported_at,
          created_at,
          updated_at
        `
      )
      .eq('floral_proposal_id', floralProposalId)
      .maybeSingle();

    if (existingError) {
      console.error(
        '[FloralProposalRepositoryService] upsertShoppingList existing error:',
        existingError
      );
      throw existingError;
    }

    let shoppingList: FloralProposalShoppingList;

    if (existing) {
      shoppingList = existing as FloralProposalShoppingList;
      const { error: clearError } = await client
        .from('floral_proposal_shopping_list_items')
        .delete()
        .eq(
          'floral_proposal_shopping_list_id',
          shoppingList.floral_proposal_shopping_list_id
        );

      if (clearError) {
        console.error(
          '[FloralProposalRepositoryService] upsertShoppingList clear error:',
          clearError
        );
        throw clearError;
      }
    } else {
      const { data, error } = await client
        .from('floral_proposal_shopping_lists')
        .insert({
          floral_proposal_id: floralProposalId,
          status: 'generated',
        })
        .select(
          `
            floral_proposal_shopping_list_id,
            floral_proposal_id,
            status,
            generated_at,
            exported_at,
            created_at,
            updated_at
          `
        )
        .single();

      if (error || !data) {
        console.error(
          '[FloralProposalRepositoryService] upsertShoppingList create error:',
          error
        );
        throw error ?? new Error('Unable to create floral proposal shopping list.');
      }

      shoppingList = data as FloralProposalShoppingList;
    }

    if (!items.length) {
      return shoppingList;
    }

    const { error: itemError } = await client
      .from('floral_proposal_shopping_list_items')
      .insert(
        items.map((item) => ({
          floral_proposal_shopping_list_id:
            shoppingList.floral_proposal_shopping_list_id,
          vendor_id: item.vendor_id ?? null,
          vendor_item_pack_id: item.vendor_item_pack_id ?? null,
          catalog_item_id: item.catalog_item_id ?? null,
          item_name: item.item_name,
          item_type: item.item_type,
          unit_type: item.unit_type,
          required_units: item.required_units,
          reserve_percent: item.reserve_percent,
          reserve_units: item.reserve_units,
          total_units_to_buy: item.total_units_to_buy,
          units_per_pack: item.units_per_pack ?? null,
          required_pack_count: item.required_pack_count ?? null,
          estimated_pack_cost: item.estimated_pack_cost ?? null,
          total_estimated_cost: item.total_estimated_cost ?? null,
          notes: item.notes ?? null,
        }))
      );

    if (itemError) {
      console.error(
        '[FloralProposalRepositoryService] upsertShoppingList items error:',
        itemError
      );
      throw itemError;
    }

    return shoppingList;
  }
}


