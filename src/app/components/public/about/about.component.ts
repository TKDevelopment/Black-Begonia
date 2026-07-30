import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from "@angular/router";
import { AnalyticsActionDirective } from '../../../shared/directives/analytics-action.directive';

@Component({
  selector: 'app-about',
  imports: [RouterLink, NgOptimizedImage, AnalyticsActionDirective],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {

}
