import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type FloralOffering = {
  title: string;
  description: string;
  image: string;
  accent?: string;
};

type FloralHighlight = {
  title: string;
  text: string;
};

type FaqItem = {
  question: string;
  answer: string;
  isOpen: boolean;
};

@Component({
  selector: 'app-general-services',
  standalone: true,
  imports: [CommonModule, RouterLink, NgOptimizedImage],
  templateUrl: './general-services.component.html',
  styleUrl: './general-services.component.scss'
})
export class GeneralServicesComponent {
  featuredOfferings: FloralOffering[] = [
    {
      title: 'Bi-Weekly/Monthly Subscriptions',
      description:
        `Bring fresh florals into your home with a thoughtfully designed arrangement delivered on a bi-weekly or monthly basis. Each design is created with your home décor, personal style, and the beauty of seasonal blooms in mind, ensuring every arrangement feels natural, intentional, and perfectly suited to your space. Subscription deliveries begin at a minimum of $150 per arrangement.`,
      image: 'assets/images/website/photo-dec-06-4-23-21-pm.webp'
    },
    {
      title: 'Event Florals',
      description:
        `Florals designed to elevate gatherings of all kinds, from bridal showers and rehearsal dinners to birthday celebrations, private parties, and corporate events. Each arrangement is thoughtfully created to reflect the atmosphere, scale, and style of your event, using seasonal blooms and intentional design to enhance the overall experience.`,
      image: 'assets/images/website/1000005242.jpg'
    },
    {
      title: 'Sympathy & Memorial',
      description:
        `Thoughtfully designed floral arrangements created to honor and remember meaningful lives. With care and sensitivity, we craft elegant pieces that offer comfort, express remembrance, and bring a sense of peace and beauty to memorial services and gatherings.`,
      image: 'assets/images/website/DSC_2652.webp'
    },
    {
      title: 'Installations & Styling',
      description:
        `From intimate statement pieces to immersive floral installations, we design florals that transform a space and shape the atmosphere of an event or setting. Whether for entryways, tablescapes, storefronts, or editorial styling, each design is created to feel intentional, striking, and visually memorable.`,
      image: 'assets/images/website/487367734_1194785119317556_2221152768559106190_n.webp'
    }
  ];

  highlights: FloralHighlight[] = [
    {
      title: 'Seasonal & Intentional',
      text: `We design with the season in mind, selecting blooms that feel fresh, artful, and naturally suited to your event or arrangement.`
    },
    {
      title: 'Designed Around Your Space',
      text: `Whether it’s a dining table, a storefront, a celebration venue, or a personal gift, we consider how the florals will live within the space.`
    },
    {
      title: 'Softly Romantic, Always Elevated',
      text: `Our style leans romantic, textural, and refined — floral design that feels beautiful without feeling overdone.`
    },
    {
      title: 'Custom, Not Cookie-Cutter',
      text: `No two floral stories are exactly alike. Each design is built around your palette, your priorities, and the mood you want to create.`
    }
  ];

  faqs: FaqItem[] = [
    {
      question: 'Do you offer delivery?',
      answer:
        `Yes — delivery is available for many floral orders depending on the size, scope, and location of the order. Larger event work, installations, and styled florals typically include delivery and on-site placement as part of the service. For smaller custom orders, delivery availability can vary, so we recommend reaching out with your date and location.`,
      isOpen: true
    },
    {
      question: 'Can I request a custom color palette?',
      answer:
        `Absolutely. Most of our floral work is custom, so we’re happy to work within a preferred palette, mood, or overall aesthetic. Whether you’re drawn to something soft and neutral, colorful and joyful, or dark and romantic, we’ll guide the floral selections in a direction that feels cohesive and intentional.`,
      isOpen: false
    },
    {
      question: 'How far in advance should I inquire?',
      answer:
        `For larger events, styled gatherings, and floral installations, reaching out as early as possible is best so we can confirm availability and plan intentionally. Smaller floral orders may sometimes be accommodated on shorter notice depending on the calendar, but advance notice is always appreciated — especially for date-specific events and custom requests.`,
      isOpen: false
    },
    {
      question: 'What kinds of general floral services do you offer?',
      answer:
        `We offer subscription services, event florals, shower and dinner florals, sympathy arrangements, floral styling, floral installations, and other custom floral requests. If your need doesn’t fit neatly into one category, that’s perfectly okay — we’re happy to talk through it and recommend the best approach.`,
      isOpen: false
    },
    {
      question: 'Do you offer recurring or subscription florals?',
      answer:
        `For select clients, recurring floral arrangements may be available for businesses, hosting, or ongoing styling needs. If you’re interested in a recurring floral service, reach out with a few details about your space, preferred frequency, and overall vision.`,
      isOpen: false
    }
  ];

  toggleFaq(index: number): void {
    this.faqs[index].isOpen = !this.faqs[index].isOpen;
  }
}
