import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from "@angular/router";


interface PortfolioGallery {
  slug: string;
  coupleNames: string;
  venue: string;
  coverImage: string;
  position: string;
}

@Component({
  selector: 'app-portfolio',
  imports: [RouterLink, CommonModule],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss'
})
export class PortfolioComponent {
  galleries: PortfolioGallery[] = [
    {
      slug: 'nathan-kirsten',
      coupleNames: 'Nate & Kirsten',
      venue: 'OCEAN CLIFF, NEWPORT',
      coverImage: 'assets/images/weddings/Kirsten-Nate/0598-OLAS-E89A9379.jpg',
      position: 'left'
    },
    {
      slug: 'siwei-simon',
      coupleNames: 'Siwei & Simon',
      venue: 'TPC STONEBRAE',
      coverImage: 'assets/images/weddings/Siwei+Simon/1000005231.jpg',
      position: 'center'
    },
    {
      slug: 'eric-madison',
      coupleNames: 'Eric & Madison',
      venue: 'TPC STONEBRAE',
      coverImage: 'assets/images/weddings/Eric-Madison/1000005144.jpg',
      position: 'right'
    },
    {
      slug: 'jason-aurelia',
      coupleNames: 'Jason & Aurelia',
      venue: 'TPC STONEBRAE',
      coverImage: 'assets/images/1000005134.jpg',
      position: 'left'
    }
  ];
}
