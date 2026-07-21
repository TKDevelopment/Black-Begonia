import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { SearchFilterBarComponent, SearchFilterGroup } from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';
import { AdminTableColumn, EntityTableShellComponent } from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import { StatusBadgeComponent } from '../../../shared/components/private/status-badge/status-badge.component';
import { PaymentObligationListRow, PaymentRepositoryService } from '../../../core/supabase/repositories/payment-repository.service';
import { PaymentObligationModalComponent } from './components/payment-obligation-modal/payment-obligation-modal.component';
import { PaymentSettingsModalComponent } from './components/payment-settings-modal/payment-settings-modal.component';
import { formatDateOnlyForDisplay } from '../../../core/utils/date-only';

@Component({
  selector: 'app-payments', standalone: true,
  imports: [CommonModule, CrmPageHeaderComponent, ErrorStateBlockComponent, SearchFilterBarComponent, EntityTableShellComponent, EntityTableCellDirective, StatusBadgeComponent, PaymentObligationModalComponent, PaymentSettingsModalComponent],
  templateUrl: './payments.component.html', styleUrl: './payments.component.scss',
})
export class PaymentsComponent implements OnInit {
  private readonly payments = inject(PaymentRepositoryService);
  readonly loading = signal(true); readonly error = signal<string | null>(null); readonly rows = signal<PaymentObligationListRow[]>([]); readonly total = signal(0);
  readonly search = signal(''); readonly kind = signal('all'); readonly state = signal('all'); readonly method = signal('all'); readonly dueTiming = signal('all');
  readonly selectedObligationId = signal<string | null>(null); readonly settingsOpen = signal(false);
  readonly columns: AdminTableColumn[] = [{key:'project',label:'Project / Customer'},{key:'kind',label:'Payment'},{key:'amount',label:'Balance'},{key:'due',label:'Due / Event'},{key:'method',label:'Method'},{key:'status',label:'Status'}];
  readonly filters = computed<SearchFilterGroup[]>(() => [
    {key:'kind',label:'Payment',value:this.kind(),options:[{label:'All Payments',value:'all'},{label:'Deposit',value:'deposit'},{label:'Final Payment',value:'final_payment'}]},
    {key:'state',label:'Status',value:this.state(),options:[{label:'All Statuses',value:'all'},{label:'Due',value:'due'},{label:'Partially Paid',value:'partially_paid'},{label:'Paid',value:'paid'},{label:'Review Required',value:'review_required'}]},
    {key:'method',label:'Method',value:this.method(),options:[{label:'All Methods',value:'all'},{label:'Card',value:'stripe'},{label:'Venmo',value:'venmo'},{label:'Cash',value:'cash'},{label:'Check',value:'check'}]},
    {key:'dueTiming',label:'Timing',value:this.dueTiming(),options:[{label:'All Dates',value:'all'},{label:'Overdue',value:'overdue'},{label:'Upcoming',value:'upcoming'}]},
  ]);
  async ngOnInit() { await this.load(); }
  async load() { this.loading.set(true); this.error.set(null); try { const page=await this.payments.listObligations({search:this.search(),kind:this.nullAll(this.kind()),state:this.nullAll(this.state()),method:this.nullAll(this.method()),dueTiming:this.nullAll(this.dueTiming())}); this.rows.set(page.rows);this.total.set(page.total); } catch { this.error.set('We could not load payments right now.'); } finally { this.loading.set(false); } }
  async onSearchChange(value:string){this.search.set(value);await this.load();}
  async onFilterChange(event:{key:string;value:string}){if(event.key==='kind')this.kind.set(event.value);if(event.key==='state')this.state.set(event.value);if(event.key==='method')this.method.set(event.value);if(event.key==='dueTiming')this.dueTiming.set(event.value);await this.load();}
  async reset(){this.search.set('');this.kind.set('all');this.state.set('all');this.method.set('all');this.dueTiming.set('all');await this.load();}
  money(value:number|undefined){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value??0);}
  date(value:string|null|undefined){return formatDateOnlyForDisplay(value,'Not set',{month:'short',day:'numeric',year:'numeric'});}
  label(value:string|null|undefined){return value?value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()):'Not recorded';}
  tone(row:PaymentObligationListRow):'neutral'|'info'|'success'|'warning'|'danger'|'purple'{if(row.has_exception||row.status==='review_required')return'danger';if(row.status==='paid')return'success';if(row.status==='partially_paid')return'info';if(row.status==='due')return'warning';return'neutral';}
  private nullAll(value:string){return value==='all'?undefined:value;}
}
