import { Injectable } from '@angular/core';
import { Contact } from '../../models/contact';
import { Lead } from '../../models/lead';
import { Project } from '../../models/project';
import { formatDateOnlyForDisplay } from '../../utils/date-only';
import { ContactRepositoryService } from '../repositories/contact-repository.service';
import { ProjectRepositoryService } from '../repositories/project-repository.service';

export interface ConvertLeadInput {
  project_name: string;
  internal_notes?: string | null;
  send_deposit_request: boolean;
}

export interface ConvertLeadResult {
  project: Project;
  primaryContact: Contact;
  partnerContact: Contact | null;
  plannerContact: Contact | null;
  requestDelivery: 'not_requested' | 'queued' | 'failed';
  requestError?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class LeadConversionService {
  constructor(
    private contactRepository: ContactRepositoryService,
    private projectRepository: ProjectRepositoryService
  ) {}

  async convertLead(
    lead: Lead,
    payload: ConvertLeadInput
  ): Promise<ConvertLeadResult> {
    if (lead.status !== 'proposal_accepted') {
      throw new Error(
        'Only accepted Floral Proposal leads can be converted to projects.'
      );
    }

    const { data, error } = await this.projectRepository.client.rpc(
      'convert_lead_to_project_with_payments',
      {
        p_lead_id: lead.lead_id,
        p_project_fields: {
          project_name: payload.project_name,
          internal_notes: payload.internal_notes ?? null,
        },
        p_contact_fields: {},
        p_command_key: crypto.randomUUID(),
        p_test_fail_after_stage: null,
      }
    );
    if (error) throw error;

    const conversion = data as {
      project: Project;
      primaryContactId: string;
      partnerContactId?: string | null;
      plannerContactId?: string | null;
      depositObligationId: string;
    };
    const primaryContact = await this.contactRepository.getContactById(
      conversion.primaryContactId
    );
    if (!primaryContact) {
      throw new Error('Converted primary contact could not be loaded.');
    }
    const partnerContact = conversion.partnerContactId
      ? await this.contactRepository.getContactById(conversion.partnerContactId)
      : null;
    const plannerContact = conversion.plannerContactId
      ? await this.contactRepository.getContactById(conversion.plannerContactId)
      : null;

    let requestDelivery: ConvertLeadResult['requestDelivery'] = 'not_requested';
    let requestError: string | null = null;
    if (payload.send_deposit_request) {
      try {
        const depositCents = Math.round(
          Number((conversion.project as any).deposit_amount ?? 0) * 100
        );
        const obligation = await this.projectRepository.client
          .from('project_payment_records')
          .select('outstanding_amount')
          .eq('project_payment_record_id', conversion.depositObligationId)
          .single();
        const principalCents = Math.round(
          Number(obligation.data?.outstanding_amount ?? depositCents) * 100
        );
        requestDelivery = await this.issueDepositRequest(
          conversion.depositObligationId,
          principalCents
        );
        requestError =
          requestDelivery === 'failed'
            ? 'The project was converted, but the deposit email needs a manual retry.'
            : null;
      } catch (requestFailure) {
        requestDelivery = 'failed';
        requestError =
          requestFailure instanceof Error
            ? requestFailure.message
            : 'Deposit request delivery failed.';
      }
    }

    return {
      project: conversion.project,
      primaryContact,
      partnerContact,
      plannerContact,
      requestDelivery,
      requestError,
    };
  }

  async issueDepositRequest(
    obligationId: string,
    principalCents: number
  ): Promise<'queued' | 'failed'> {
    const issued = await this.projectRepository.client.functions.invoke(
      'issue-payment-request',
      {
        body: {
          obligationIds: [obligationId],
          principalCents,
          kind: 'deposit',
          commandKey: crypto.randomUUID(),
        },
      }
    );
    if (issued.error) throw issued.error;

    const dispatchResult = issued.data as {
      deliveryDispatch?: string;
      deliveryError?: string | null;
    } | null;
    if (dispatchResult?.deliveryDispatch === 'failed') {
      throw new Error(
        dispatchResult.deliveryError
          || 'The payment email was rejected by the provider and needs a manual retry.'
      );
    }
    return 'queued';
  }

  buildDefaultProjectName(lead: Lead): string {
    const eventLabel = this.titleCase(lead.service_type || 'event');
    const clientLabel = `${lead.first_name} ${lead.last_name}`.trim();
    const dateLabel = lead.event_date
      ? formatDateOnlyForDisplay(lead.event_date, '', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

    return [clientLabel, eventLabel, dateLabel].filter(Boolean).join(' • ');
  }

  private titleCase(value: string): string {
    return value.replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
