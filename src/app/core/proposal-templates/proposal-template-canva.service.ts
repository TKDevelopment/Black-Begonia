import { Injectable } from '@angular/core';

import {
  ProposalTemplateCanvaImportSummary,
  ProposalTemplateEditorAsset,
} from './proposal-template-document.models';
import { SupabaseService } from '../supabase/clients/supabase.service';

export interface CanvaConnectionStatus {
  connected: boolean;
  display_name?: string | null;
  scopes: string[];
  expires_at?: string | null;
  canva_user_id?: string | null;
  canva_team_id?: string | null;
}

export interface CanvaOAuthStartResult {
  session_id: string;
  authorization_url: string;
  callback_origin: string;
}

export interface CanvaDesignSummary {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  thumbnail_width?: number | null;
  thumbnail_height?: number | null;
  page_count: number;
  updated_at?: string | null;
  edit_url?: string | null;
  view_url?: string | null;
}

export interface CanvaDesignListResult {
  items: CanvaDesignSummary[];
  continuation: string | null;
}

export interface CanvaImportedPage {
  page_index: number;
  page_name: string;
  width: number;
  height: number;
  asset: ProposalTemplateEditorAsset;
  thumbnail_url?: string | null;
}

export interface CanvaImportResult {
  summary: ProposalTemplateCanvaImportSummary;
  assets: ProposalTemplateEditorAsset[];
  imported_pages: CanvaImportedPage[];
}

interface CanvaFunctionEnvelope<T> {
  success: boolean;
  error?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class ProposalTemplateCanvaService {
  private readonly functionName = 'canva-connect';

  constructor(private readonly supabaseService: SupabaseService) {}

  async getConnectionStatus(): Promise<CanvaConnectionStatus> {
    const response = await this.invoke<CanvaConnectionStatus>({ action: 'status' });
    return response.data ?? { connected: false, scopes: [] };
  }

  async startConnection(appOrigin: string): Promise<CanvaOAuthStartResult> {
    const response = await this.invoke<CanvaOAuthStartResult>({
      action: 'start',
      app_origin: appOrigin,
    });

    if (!response.data) {
      throw new Error('We could not start Canva sign-in right now.');
    }

    return response.data;
  }

  async disconnect(): Promise<void> {
    await this.invoke<null>({ action: 'disconnect' });
  }

  async listDesigns(
    query = '',
    continuation?: string | null
  ): Promise<CanvaDesignListResult> {
    const response = await this.invoke<CanvaDesignListResult>({
      action: 'list_designs',
      query,
      continuation: continuation ?? null,
    });

    return response.data ?? { items: [], continuation: null };
  }

  async importDesign(
    templateId: string,
    designId: string
  ): Promise<CanvaImportResult> {
    const response = await this.invoke<CanvaImportResult>({
      action: 'import_design',
      template_id: templateId,
      design_id: designId,
    });

    if (!response.data) {
      throw new Error('We could not import that Canva design right now.');
    }

    return response.data;
  }

  private async invoke<T>(body: Record<string, unknown>): Promise<CanvaFunctionEnvelope<T>> {
    const { data, error } = await this.supabaseService
      .getClient()
      .functions.invoke(this.functionName, { body });

    if (error) {
      console.error('[ProposalTemplateCanvaService] invoke error:', error);
      throw new Error('We could not reach Canva integration services right now.');
    }

    const envelope = (data ?? {}) as CanvaFunctionEnvelope<T>;
    if (envelope.success === false) {
      throw new Error(envelope.error || 'The Canva integration request failed.');
    }

    return envelope;
  }
}
