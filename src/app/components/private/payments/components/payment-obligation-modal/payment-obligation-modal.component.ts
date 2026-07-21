import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PaymentObligationDetail, PaymentRepositoryService } from '../../../../../core/supabase/repositories/payment-repository.service';

@Component({selector:'app-payment-obligation-modal',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./payment-obligation-modal.component.html',styleUrl:'./payment-obligation-modal.component.scss'})
export class PaymentObligationModalComponent implements OnInit {
  @Input({required:true}) obligationId!:string; @Output() closed=new EventEmitter<void>(); @Output() changed=new EventEmitter<void>();
  private readonly repository=inject(PaymentRepositoryService);private readonly router=inject(Router);
  readonly loading=signal(true);readonly saving=signal(false);readonly error=signal<string|null>(null);readonly detail=signal<PaymentObligationDetail|null>(null);
  holdType:'legal'|'dispute'='dispute';holdAction:'placed'|'released'='placed';holdReason='';
  async ngOnInit(){await this.load();}
  async load(){this.loading.set(true);this.error.set(null);try{this.detail.set(await this.repository.getObligationDetail(this.obligationId));}catch{this.error.set('Payment details are unavailable.');}finally{this.loading.set(false);}}
  async saveHold(){const detail=this.detail();if(!detail||!this.holdReason.trim())return;this.saving.set(true);this.error.set(null);try{await this.repository.setLegalHold(detail.project.project_id,this.holdAction,this.holdType,this.holdReason,crypto.randomUUID());this.holdReason='';await this.load();this.changed.emit();}catch(error){this.error.set(error instanceof Error?error.message:'The hold could not be updated.');}finally{this.saving.set(false);}}
  openProject(){const id=this.detail()?.project.project_id;if(id){this.closed.emit();void this.router.navigate(['/admin/projects',id]);}}
  async revokeRequest(requestId:string){const reason=window.prompt('Reason for revoking this payment request');if(!reason?.trim())return;await this.runAction(()=>this.repository.revokeRequest(requestId,reason));}
  async setObligationState(state:'waived'|'canceled'){const reason=window.prompt(`Reason this obligation is ${state}`);if(!reason?.trim())return;await this.runAction(()=>this.repository.setObligationState(this.obligationId,state,reason));}
  async resolveException(exceptionId:string){const resolution=window.prompt('Resolution: external_refund, retained_credit, correction, matched, dismissed, or status_reviewed');if(!resolution?.trim())return;const note=window.prompt('Required external reference or resolution note');if(!note?.trim())return;await this.runAction(()=>this.repository.resolveException(exceptionId,resolution,note));}
  money(value:number|null|undefined){return value===null||value===undefined?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);}
  date(value:string|null|undefined){return value?new Date(value).toLocaleString():'Not recorded';}
  label(value:string|null|undefined){return value?value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()):'Not recorded';}
  private async runAction(action:()=>Promise<void>){this.saving.set(true);this.error.set(null);try{await action();await this.load();this.changed.emit();}catch(error){this.error.set(error instanceof Error?error.message:'The payment action could not be recorded.');}finally{this.saving.set(false);}}
}
