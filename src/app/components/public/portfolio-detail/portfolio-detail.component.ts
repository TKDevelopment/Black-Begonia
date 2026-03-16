import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

interface PortfolioGallery {
  slug: string;
  coupleNames: string;
  venue: string;
  coverImage: string;
  heroImage?: string;
  description?: string;
  images: string[];
}

const PORTFOLIO_GALLERIES: PortfolioGallery[] = [
  {
    slug: 'nathan-kirsten',
    coupleNames: 'Nate & Kirsten',
    venue: 'OCEAN CLIFF, NEWPORT',
    coverImage: 'assets/images/weddings/Kirsten & Nate/0598-OLAS-E89A9379.jpg',
    heroImage: 'assets/images/weddings/Kirsten-Nate/0295-OLAS-E89A8219.jpg',
    description: 'A romantic floral celebration with soft, timeless textures.',
    images: [
      'assets/images/weddings/Kirsten-Nate/0216-OLAS-E89A7969.jpg', 
      'assets/images/weddings/Kirsten-Nate/0241-OLAS-E89A8036.jpg', 
      'assets/images/weddings/Kirsten-Nate/0324-OLAS-_Y8A4270.jpg',
      'assets/images/weddings/Kirsten-Nate/0269-OLAS-E89A8144.jpg', 
      'assets/images/weddings/Kirsten-Nate/0270-OLAS-E89A8152.jpg', 
      'assets/images/weddings/Kirsten-Nate/0295-OLAS-E89A8219.jpg', 
      'assets/images/weddings/Kirsten-Nate/0325-OLAS-E89A8347.jpg', 
      'assets/images/weddings/Kirsten-Nate/0326-OLAS-E89A8349.jpg', 
      'assets/images/weddings/Kirsten-Nate/0327-OLAS-E89A8354.jpg', 
      'assets/images/weddings/Kirsten-Nate/0331-OLAS-E89A8368.jpg',
      'assets/images/weddings/Kirsten-Nate/0332-OLAS-E89A8373.jpg', 
      'assets/images/weddings/Kirsten-Nate/0333-OLAS-_Y8A4276.jpg', 
      'assets/images/weddings/Kirsten-Nate/0329-OLAS-E89A8359.jpg',
      'assets/images/weddings/Kirsten-Nate/0334-OLAS-_Y8A4277.jpg', 
      'assets/images/weddings/Kirsten-Nate/0337-OLAS-_Y8A4279.jpg', 
      'assets/images/weddings/Kirsten-Nate/0335-OLAS-E89A8378.jpg', 
      'assets/images/weddings/Kirsten-Nate/0336-OLAS-E89A8379.jpg', 
      'assets/images/weddings/Kirsten-Nate/0338-OLAS-E89A8382.jpg', 
      'assets/images/weddings/Kirsten-Nate/0339-OLAS-E89A8387.jpg', 
      'assets/images/weddings/Kirsten-Nate/0342-OLAS-E89A8397.jpg', 
      'assets/images/weddings/Kirsten-Nate/0393-OLAS-_Y8A4306.jpg', 
      'assets/images/weddings/Kirsten-Nate/0340-OLAS-E89A8390.jpg', 
      'assets/images/weddings/Kirsten-Nate/0483-OLAS-E89A8853.jpg', 
      'assets/images/weddings/Kirsten-Nate/0465-OLAS-E89A8772.jpg', 
      'assets/images/weddings/Kirsten-Nate/0504-OLAS-E89A8982.jpg',
      'assets/images/weddings/Kirsten-Nate/0513-OLAS-_Y8A4519.jpg', 
      'assets/images/weddings/Kirsten-Nate/0594-OLAS-E89A9364.jpg',
      'assets/images/weddings/Kirsten-Nate/0491-OLAS-E89A8905.jpg', 
      'assets/images/weddings/Kirsten-Nate/0590-OLAS-E89A9351.jpg', 
      'assets/images/weddings/Kirsten-Nate/0592-OLAS-E89A9358.jpg', 
      'assets/images/weddings/Kirsten-Nate/0598-OLAS-E89A9378.jpg', 
      'assets/images/weddings/Kirsten-Nate/0600-OLAS-_Y8A4733.jpg', 
      'assets/images/weddings/Kirsten-Nate/0615-OLAS-E89A9406.jpg', 
      'assets/images/weddings/Kirsten-Nate/0604-OLAS-_Y8A4745.jpg',
      'assets/images/weddings/Kirsten-Nate/0633-OLAS-E89A9458.jpg'
    ]
  },
  {
    slug: 'siwei-simon',
    coupleNames: 'Siwei & Simon',
    venue: 'TPC STONEBRAE',
    coverImage: 'assets/images/1000005131.jpg',
    heroImage: 'assets/images/weddings/Siwei+Simon/1000005227.jpg',
    description: 'Elegant floral design with refined, modern styling.',
    images: [
      'assets/images/weddings/Siwei+Simon/1000005215.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005224.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005225.jpg',
      'assets/images/weddings/Siwei+Simon/1000005209.jpg',
      'assets/images/weddings/Siwei+Simon/1000005219.jpg',
      'assets/images/weddings/Siwei+Simon/1000005223.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005218.jpg',  
      'assets/images/weddings/Siwei+Simon/1000005220.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005221.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005216.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005222.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005229.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005231.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005232.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005233.jpg', 
      'assets/images/weddings/Siwei+Simon/1000005235.jpg'
    ]
  },
  {
    slug: 'eric-madison',
    coupleNames: 'Eric & Madison',
    venue: 'TPC STONEBRAE',
    coverImage: 'assets/images/weddings/Eric-Madison/1000005144.jpg',
    heroImage: 'assets/images/weddings/Eric-Madison/1000005144.jpg',
    description: 'Elegant floral design with refined, modern styling.',
    images: [
      'assets/images/weddings/Eric-Madison/1000005144.jpg',
      'assets/images/weddings/Eric-Madison/1000005207.jpg',
      'assets/images/weddings/Eric-Madison/1000005240.jpg',
    ]
  }
];

@Component({
  selector: 'app-portfolio-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './portfolio-detail.component.html',
  styleUrl: './portfolio-detail.component.scss'
})
export class PortfolioDetailComponent {
  gallery?: PortfolioGallery;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');

      this.gallery = PORTFOLIO_GALLERIES.find(g => g.slug === slug);

      if (!this.gallery) {
        this.router.navigate(['/portfolio']);
      }
    });
  }
}
