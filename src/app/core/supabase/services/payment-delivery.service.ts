import { Injectable } from '@angular/core';
import { PaymentDelivery } from '../../models/payment-delivery';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({providedIn:'root'})
export class PaymentDeliveryService {
  constructor(private readonly supabase:SupabaseService){}
  async getProjectDeliveries(projectId:string):Promise<PaymentDelivery[]>{const{data,error}=await this.supabase.getClient().from('payment_message_deliveries').select('*').eq('project_id',projectId).order('created_at',{ascending:false});if(error)throw error;return(data??[])as PaymentDelivery[];}
  async retry(deliveryId:string,reason:string):Promise<PaymentDelivery>{const{data,error}=await this.supabase.getClient().functions.invoke('retry-payment-delivery',{body:{deliveryId,reason:reason.trim()}});if(error)throw error;if(data?.deliveryDispatch==='failed')throw new Error(data.deliveryError||'The payment provider rejected the retry.');return data as PaymentDelivery;}
  async setReminderControl(projectId:string,obligationId:string|null,enabled:boolean,pausedUntil:string|null,reason:string):Promise<void>{const{error}=await this.supabase.getClient().rpc('set_payment_reminder_control',{p_project_id:projectId,p_obligation_id:obligationId,p_enabled:enabled,p_paused_until:pausedUntil,p_reason:reason.trim()});if(error)throw error;}
}
