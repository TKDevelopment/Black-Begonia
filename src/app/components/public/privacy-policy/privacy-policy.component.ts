import { Component, OnInit } from '@angular/core';
import { SeoService } from '../../../core/seo/seo.service';

@Component({
  selector: 'app-privacy-policy',
  imports: [],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss'
})
export class PrivacyPolicyComponent implements OnInit {
  constructor(private readonly seo: SeoService) {}

  ngOnInit(): void {
    this.seo.setPageMeta({
      title: 'Privacy Policy | Black Begonia Florals',
      description: 'How Black Begonia Florals handles inquiries and public website analytics.',
      url: 'https://blackbegoniaflorals.com/privacy-policy',
      image: 'https://blackbegoniaflorals.com/assets/images/og-default.png',
    });
  }
}
