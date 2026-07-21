import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaymentCollectionSettings } from '../../../../../core/models/payment-delivery';
import { PaymentRepositoryService } from '../../../../../core/supabase/repositories/payment-repository.service';

@Component({selector:'app-payment-settings-modal',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./payment-settings-modal.component.html',styleUrl:'./payment-settings-modal.component.scss'})
export class PaymentSettingsModalComponent implements OnInit {
  @Output() closed=new EventEmitter<void>();@Output() saved=new EventEmitter<void>();private readonly repository=inject(PaymentRepositoryService);
  readonly loading=signal(true);readonly saving=signal(false);readonly error=signal<string|null>(null);
  settings:PaymentCollectionSettings={business_timezone:'America/New_York',send_window_start:'09:00',send_window_end:'17:00',cash_instructions:'',check_instructions:'',venmo_business_target:null,stripe_enabled:false,venmo_enabled:false,reminders_enabled:false,collection_enabled:false,provider_environment:'sandbox',updated_at:''};
  async ngOnInit(){try{this.settings=await this.repository.getSettings();}catch{this.error.set('Collection settings are unavailable.');}finally{this.loading.set(false);}}
  async save(){this.saving.set(true);this.error.set(null);try{this.settings=await this.repository.updateSettings(this.settings,crypto.randomUUID());this.saved.emit();}catch(error){this.error.set(error instanceof Error?error.message:'Settings could not be saved.');}finally{this.saving.set(false);}}
}
