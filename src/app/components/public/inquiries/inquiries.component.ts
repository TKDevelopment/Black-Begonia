import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from "@angular/router";
import { AnalyticsActionDirective } from '../../../shared/directives/analytics-action.directive';

@Component({
  selector: 'app-inquiries',
  imports: [RouterLink, AnalyticsActionDirective],
  templateUrl: './inquiries.component.html',
  styleUrl: './inquiries.component.scss'
})
export class InquiriesComponent {

}
