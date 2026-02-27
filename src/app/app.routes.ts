import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { LandingComponent } from './components/public/landing/landing.component';
import { AboutComponent } from './components/public/about/about.component';
import { PrivacyPolicyComponent } from './components/public/privacy-policy/privacy-policy.component';
import { TermsAndConditionsComponent } from './components/public/terms-and-conditions/terms-and-conditions.component';
import { WorkshopsComponent } from './components/public/workshops/workshops.component';
import { PortfolioComponent } from './components/public/portfolio/portfolio.component';
import { LoginComponent } from './components/public/login/login.component';
import { PasswordRecoveryComponent } from './components/public/password-recovery/password-recovery.component';
import { PasscodeComponent } from './components/public/passcode/passcode.component';
import { PrivateLayoutComponent } from './layouts/private-layout/private-layout.component';
import { InquiriesComponent } from './components/public/inquiries/inquiries.component';
import { TestimonialsComponent } from './components/public/testimonials/testimonials.component';
import { authGuard } from './guards/auth.guard';
import { CalendarComponent } from './components/private/calendar/calendar.component';
import { EventsComponent } from './components/private/events/events.component';
import { PaymentsComponent } from './components/private/payments/payments.component';
import { ClientsComponent } from './components/private/clients/clients.component';
import { CoordinatorsComponent } from './components/private/coordinators/coordinators.component';
import { ProposalComponent } from './components/view/proposal/proposal.component';
import { PaymentSuccessComponent } from './components/view/payment-success/payment-success.component';
import { PaymentCancelComponent } from './components/view/payment-cancel/payment-cancel.component';
import { SubmitReviewComponent } from './components/view/submit-review/submit-review.component';
import { DeclineProposalComponent } from './components/view/decline-proposal/decline-proposal.component';
import { PaymentComponent } from './components/view/payment/payment.component';
import { GeneralInquiriesComponent } from './components/public/general-inquiries/general-inquiries.component';
import { WeddingInquiriesComponent } from './components/public/wedding-inquiries/wedding-inquiries.component';
import { GeneralServicesComponent } from './components/public/general-services/general-services.component';
import { WeddingServicesComponent } from './components/public/wedding-services/wedding-services.component';

export const routes: Routes = [
    {
        path: '',
        component: PublicLayoutComponent,
        children: [
            { path: '', component: LandingComponent },
            { path: 'about', component: AboutComponent },
            { path: 'portfolio', component: PortfolioComponent },
            { path: 'inquiries', component: InquiriesComponent },
            { path: 'inquiries/general', component: GeneralInquiriesComponent },
            { path: 'inquiries/weddings', component: WeddingInquiriesComponent },
            { path: 'services/weddings', component: WeddingServicesComponent },
            { path: 'services/general', component: GeneralServicesComponent },
            { path: 'workshops', component: WorkshopsComponent },
            { path: 'testimonials', component: TestimonialsComponent },
            { path: 'login', component:LoginComponent },
            { path: 'password-recovery', component: PasswordRecoveryComponent },
            { path: 'passcode', component: PasscodeComponent },
            { path: 'privacy-policy', component: PrivacyPolicyComponent },
            { path: 'terms-and-conditions', component: TermsAndConditionsComponent },
        ]
    },
    {
        path: '',
        component: PrivateLayoutComponent,
        canActivateChild: [authGuard],
        children: [
            { path: 'dashboard', component: CalendarComponent },
            { path: 'events', component: EventsComponent },
            { path: 'payments', component: PaymentsComponent },
            { path: 'clients', component: ClientsComponent },
            { path: 'coordinators', component: CoordinatorsComponent },
        ]
    },
    {
        path: 'view',
        component: PublicLayoutComponent,
        children: [
            { path: 'proposal', component: ProposalComponent },
            { path: 'proposal/decline', component: DeclineProposalComponent },
            { path: 'payment', component:  PaymentComponent },
            { path: 'payment/success', component: PaymentSuccessComponent },
            { path: 'payment/cancel', component: PaymentCancelComponent },
            { path: 'reviews', component: SubmitReviewComponent },
        ]
    }
];
