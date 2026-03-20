import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type ProcessStep = {
  title: string;
  showInquiry: boolean;
  description: string;
  image: string;
}

type WeddingHighlight = {
  title: string;
  text: string;
};

type WeddingFaq = {
  question: string;
  answer: string;
  isOpen: boolean;
};

@Component({
  selector: 'app-wedding-services',
  imports: [CommonModule, RouterLink, NgOptimizedImage],
  templateUrl: './wedding-services.component.html',
  styleUrl: './wedding-services.component.scss'
})
export class WeddingServicesComponent {
  currentStep = 0;

  steps: ProcessStep[] = [
    {
      title: 'INQUIRE AND CONNECT',
      showInquiry: false,
      description: `Start by reaching out through our inquiry form. We’ll review your event details, get a feel for your floral vision, and schedule a consultation to learn more about your style, priorities, and what matters most for your day.`,
      image: 'assets/images/website/1000005135.jpg'
    },
    {
      title: 'DESIGN AND PROPOSAL',
      showInquiry: false,
      description: `After our conversation, we’ll begin shaping your floral concept and preparing a custom proposal. This gives you a clear picture of the aesthetic direction, recommended florals, and the overall scope of your event design.`,
      image: 'assets/images/website/JJ-7-100.jpg'
    },
    {
      title: 'BOOKING AND PLANNING',
      showInquiry: false,
      description: `When you’re ready to move forward, we’ll secure your date with a signed contract and retainer. From there, we’ll stay in touch throughout the planning process, refining details as needed as your wedding vision continues to take shape.`,
      image: 'assets/images/website/1000005142.jpg'
    },
    {
      title: 'EVENT DAY EXECUTION',
      showInquiry: false,
      description: `On the day of your event, we handle delivery, installation, styling, and all floral setup so everything is beautifully in place. Our goal is for you to be fully present, knowing every detail has been thoughtfully taken care of.`,
      image: 'assets/images/website/480770928_1161714895957912_7806770211832974345_n.jpg'
    },
    {
      title: 'INQUIRE TODAY',
      showInquiry: true,
      description: `On the day of your event, we handle delivery, installation, styling, and all floral setup so everything is beautifully in place. Our goal is for you to be fully present, knowing every detail has been thoughtfully taken care of.`,
      image: 'assets/images/website/JJ-7-100.jpg'
    }
  ]

  weddingHighlights: WeddingHighlight[] = [
    {
      title: 'Personal Flowers',
      text: `Bouquets, boutonnieres, bridesmaid florals, corsages, and all the floral pieces closest to the people at the heart of the day.`
    },
    {
      title: 'Ceremony Design',
      text: `Aisle florals, altar arrangements, statement urns, meadow moments, and ceremony pieces designed to frame your vows beautifully.`
    },
    {
      title: 'Reception Styling',
      text: `Centerpieces, sweetheart table florals, bar arrangements, escort displays, and layered floral details that shape the reception atmosphere.`
    },
    {
      title: 'Installations',
      text: `For couples wanting added impact, we design elevated floral moments that create movement, romance, and unforgettable visual presence.`
    }
  ];

  faqs: WeddingFaq[] = [
    {
      question: 'Where did the name “Black Begonia” come from?',
      answer: `Black Begonia Floral Design was inspired by a meaningful chapter of my life when I was searching for clarity, direction, and purpose in my mid-twenties. During that time, I discovered the Black Fang Begonia plant—a striking plant known for its deep, dark leaves edged with delicate points for protection. Despite its bold and dramatic appearance, the plant produces the softest blush pink flowers. To me, it became a beautiful reminder that growth often happens in unexpected places, and that even the most challenging seasons can give way to something delicate and beautiful. That symbolism is what inspired the name Black Begonia.`,
      isOpen: false
    },
    {
      question: 'How far in advance should we inquire?',
      answer: `The earlier the better, especially for full wedding floral design. Reaching out early helps ensure availability and gives us time to thoughtfully shape your floral vision as other details of the day come together. Most couples reach out a year in advance to start the design process.`,
      isOpen: true
    },
    {
      question: 'Where do you source your flowers?',
      answer: `During peak growing seasons, we prioritize sourcing flowers from local farms throughout Rhode Island and Eastern Connecticut whenever possible. Designing with seasonal, locally grown blooms allows us to incorporate flowers at their freshest and most vibrant. When planning your floral design, we carefully consider what will be naturally in season so we can thoughtfully include those varieties and create arrangements that feel abundant, organic, and reflective of the region.`,
      isOpen: false
    },
    {
      question: 'How do I know if my flowers are in season?',
      answer: `Many couples ask about the availability of beloved seasonal blooms such as peonies, lilacs, garden roses, tulips, and dahlias. While many flowers can be sourced throughout the year, certain varieties are naturally at their best during specific seasons. When these blooms are in season, they are typically more abundant and at their most beautiful. If you have your heart set on a particular flower that does not align with your wedding date, we can explore thoughtfully selected alternatives that capture the same color palette, texture, and overall aesthetic.`,
      isOpen: false
    },
    {
      question: 'Do you handle delivery and setup?',
      answer: `Yes. For wedding work, delivery, floral placement, and on-site setup are part of creating a polished final result. We want everything to feel intentional and beautifully installed when your day begins. For couples wanting added impact, we design elevated floral moments that create movement, romance, and unforgettable visual presence. Many venues also require breakdown of floral arrangements and installs at the end of your wedding night. This is a service that we offer upon request.`,
      isOpen: false
    }
  ];

  nextStep(): void {
    this.currentStep = (this.currentStep + 1) % this.steps.length;
  }

  prevStep(): void {
    this.currentStep =
      (this.currentStep - 1 + this.steps.length) % this.steps.length;
  }

  goToStep(index: number): void {
    this.currentStep = index;
  }

  toggleFaq(index: number): void {
    this.faqs[index].isOpen = !this.faqs[index].isOpen;
  }

  get current(): ProcessStep {
    return this.steps[this.currentStep];
  }

  get counter(): string {
    return `${String(this.currentStep + 1).padStart(2, '0')}/${String(this.steps.length).padStart(2, '0')}`;
  }
}
