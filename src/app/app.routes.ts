import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { LandingComponent } from './components/public/landing/landing.component';
import { PrivateLayoutComponent } from './layouts/private-layout/private-layout.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', component: LandingComponent },

      {
        path: 'about',
        loadComponent: () =>
          import('./components/public/about/about.component').then(
            m => m.AboutComponent
          ),
      },
      {
        path: 'portfolio',
        loadComponent: () =>
          import('./components/public/portfolio/portfolio.component').then(
            m => m.PortfolioComponent
          ),
      },
      {
        path: 'portfolio/:slug',
        loadComponent: () =>
          import('./components/public/portfolio-detail/portfolio-detail.component').then(
            m => m.PortfolioDetailComponent
          ),
      },
      {
        path: 'inquiries',
        loadComponent: () =>
          import('./components/public/inquiries/inquiries.component').then(
            m => m.InquiriesComponent
          ),
      },
      {
        path: 'inquiries/general',
        loadComponent: () =>
          import('./components/public/general-inquiries/general-inquiries.component').then(
            m => m.GeneralInquiriesComponent
          ),
      },
      {
        path: 'inquiries/weddings',
        loadComponent: () =>
          import('./components/public/wedding-inquiries/wedding-inquiries.component').then(
            m => m.WeddingInquiriesComponent
          ),
      },
      {
        path: 'services/weddings',
        loadComponent: () =>
          import('./components/public/wedding-services/wedding-services.component').then(
            m => m.WeddingServicesComponent
          ),
      },
      {
        path: 'services/general',
        loadComponent: () =>
          import('./components/public/general-services/general-services.component').then(
            m => m.GeneralServicesComponent
          ),
      },
      {
        path: 'workshops',
        loadComponent: () =>
          import('./components/public/workshops/workshops.component').then(
            m => m.WorkshopsComponent
          ),
      },
      {
        path: 'testimonials',
        loadComponent: () =>
          import('./components/public/testimonials/testimonials.component').then(
            m => m.TestimonialsComponent
          ),
      },
      {
        path: 'login',
        loadComponent: () =>
          import('./components/public/login/login.component').then(
            m => m.LoginComponent
          ),
      },
      {
        path: 'password-recovery',
        loadComponent: () =>
          import('./components/public/password-recovery/password-recovery.component').then(
            m => m.PasswordRecoveryComponent
          ),
      },
      {
        path: 'passcode',
        loadComponent: () =>
          import('./components/public/passcode/passcode.component').then(
            m => m.PasscodeComponent
          ),
      },
      {
        path: 'privacy-policy',
        loadComponent: () =>
          import('./components/public/privacy-policy/privacy-policy.component').then(
            m => m.PrivacyPolicyComponent
          ),
      },
      {
        path: 'terms-and-conditions',
        loadComponent: () =>
          import('./components/public/terms-and-conditions/terms-and-conditions.component').then(
            m => m.TermsAndConditionsComponent
          ),
      },
    ],
  },
  {
    path: '',
    component: PrivateLayoutComponent,
    canActivateChild: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/private/calendar/calendar.component').then(
            m => m.CalendarComponent
          ),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./components/private/events/events.component').then(
            m => m.EventsComponent
          ),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./components/private/payments/payments.component').then(
            m => m.PaymentsComponent
          ),
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./components/private/clients/clients.component').then(
            m => m.ClientsComponent
          ),
      },
      {
        path: 'coordinators',
        loadComponent: () =>
          import('./components/private/coordinators/coordinators.component').then(
            m => m.CoordinatorsComponent
          ),
      },
    ],
  },
  {
    path: 'view',
    component: PublicLayoutComponent,
    children: [
      {
        path: 'proposal',
        loadComponent: () =>
          import('./components/view/proposal/proposal.component').then(
            m => m.ProposalComponent
          ),
      },
      {
        path: 'proposal/decline',
        loadComponent: () =>
          import('./components/view/decline-proposal/decline-proposal.component').then(
            m => m.DeclineProposalComponent
          ),
      },
      {
        path: 'payment',
        loadComponent: () =>
          import('./components/view/payment/payment.component').then(
            m => m.PaymentComponent
          ),
      },
      {
        path: 'payment/success',
        loadComponent: () =>
          import('./components/view/payment-success/payment-success.component').then(
            m => m.PaymentSuccessComponent
          ),
      },
      {
        path: 'payment/cancel',
        loadComponent: () =>
          import('./components/view/payment-cancel/payment-cancel.component').then(
            m => m.PaymentCancelComponent
          ),
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./components/view/submit-review/submit-review.component').then(
            m => m.SubmitReviewComponent
          ),
      },
    ],
  },
];