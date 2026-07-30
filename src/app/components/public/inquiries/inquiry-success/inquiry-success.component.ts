import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsActionDirective } from '../../../../shared/directives/analytics-action.directive';

@Component({
  selector: 'app-inquiry-success',
  imports: [CommonModule, RouterLink, AnalyticsActionDirective],
  templateUrl: './inquiry-success.component.html',
  styleUrl: './inquiry-success.component.scss'
})
export class InquirySuccessComponent {

}
