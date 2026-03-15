import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type ProcessStep = {
  title: string;
  showInquiry: boolean;
  description: string;
  image: string;
}

@Component({
  selector: 'app-wedding-services',
  imports: [CommonModule, RouterLink],
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
      image: 'assets/images/1000005135.jpg'
    },
    {
      title: 'DESIGN AND PROPOSAL',
      showInquiry: false,
      description: `After our conversation, we’ll begin shaping your floral concept and preparing a custom proposal. This gives you a clear picture of the aesthetic direction, recommended florals, and the overall scope of your event design.`,
      image: 'assets/images/473441856_1147604270271762_4736518673784938733_n.jpg'
    },
    {
      title: 'BOOKING AND PLANNING',
      showInquiry: false,
      description: `When you’re ready to move forward, we’ll secure your date with a signed contract and retainer. From there, we’ll stay in touch throughout the planning process, refining details as needed as your wedding vision continues to take shape.`,
      image: 'assets/images/1000005142.jpg'
    },
    {
      title: 'EVENT DAY EXECUTION',
      showInquiry: false,
      description: `On the day of your event, we handle delivery, installation, styling, and all floral setup so everything is beautifully in place. Our goal is for you to be fully present, knowing every detail has been thoughtfully taken care of.`,
      image: 'assets/images/480770928_1161714895957912_7806770211832974345_n.jpg'
    },
    {
      title: 'INQUIRE TODAY',
      showInquiry: true,
      description: `On the day of your event, we handle delivery, installation, styling, and all floral setup so everything is beautifully in place. Our goal is for you to be fully present, knowing every detail has been thoughtfully taken care of.`,
      image: 'assets/images/471985440_1141939364171586_8756193674615948069_n.jpg'
    }
  ]

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

  get current(): ProcessStep {
    return this.steps[this.currentStep];
  }

  get counter(): string {
    return `${String(this.currentStep + 1).padStart(2, '0')}/${String(this.steps.length).padStart(2, '0')}`;
  }
}
