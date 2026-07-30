import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './core/layouts/public-layout/public-layout.component';
import { PrivateLayoutComponent } from './core/layouts/private-layout/private-layout.component';
import { LandingComponent } from './components/public/landing/landing.component';
import { authGuard, authChildGuard } from './core/guards/auth.guard';
import { adminRoleGuard, adminRoleChildGuard } from './core/guards/admin-role.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'pay',
    component: PublicLayoutComponent,
    data: { headerMode: 'payment' },
    children: [
      {
        path: ':token/status',
        loadComponent: () => import('./components/payment-access/payment-status/payment-status.component').then(m => m.PaymentStatusComponent),
      },
      {
        path: ':token',
        loadComponent: () => import('./components/payment-access/payment-options/payment-options.component').then(m => m.PaymentOptionsComponent),
      },
    ],
  },
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        component: LandingComponent,
        data: { analytics: { eligible: true, pageCategory: 'home' } },
      },

      {
        path: 'about',
        data: { analytics: { eligible: true, pageCategory: 'about' } },
        loadComponent: () =>
          import('./components/public/about/about.component').then(m => m.AboutComponent),
      },
      {
        path: 'portfolio',
        data: { analytics: { eligible: true, pageCategory: 'portfolio' } },
        loadComponent: () =>
          import('./components/public/portfolio/portfolio.component').then(m => m.PortfolioComponent),
      },
      {
        path: 'portfolio/:slug',
        data: { analytics: { eligible: true, pageCategory: 'portfolio_detail' } },
        loadComponent: () =>
          import('./components/public/portfolio-detail/portfolio-detail.component').then(
            m => m.PortfolioDetailComponent
          ),
      },
      {
        path: 'locations',
        data: { analytics: { eligible: true, pageCategory: 'locations' } },
        loadComponent: () =>
          import('./components/public/locations-hub/locations-hub.component').then(
            (m) => m.LocationsHubComponent
          )
      },
      {
        path: 'locations/:slug',
        data: { analytics: { eligible: true, pageCategory: 'location_detail' } },
        loadComponent: () =>
          import('./components/public/locations/locations.component').then(
            (m) => m.LocationsComponent
          )
      },
      {
        path: 'inquiries',
        data: { analytics: { eligible: true, pageCategory: 'inquiry' } },
        loadComponent: () =>
          import('./components/public/inquiries/inquiries.component').then(m => m.InquiriesComponent),
      },
      {
        path: 'inquiries/success',
        data: { analytics: { eligible: true, pageCategory: 'inquiry_success' } },
        loadComponent: () =>
          import('./components/public/inquiries/inquiry-success/inquiry-success.component').then(
            m => m.InquirySuccessComponent
          ),
      },
      {
        path: 'inquiries/general',
        data: { analytics: { eligible: true, pageCategory: 'inquiry' } },
        loadComponent: () =>
          import('./components/public/general-inquiries/general-inquiries.component').then(
            m => m.GeneralInquiriesComponent
          ),
      },
      {
        path: 'inquiries/weddings',
        data: { analytics: { eligible: true, pageCategory: 'inquiry' } },
        loadComponent: () =>
          import('./components/public/wedding-inquiries/wedding-inquiries.component').then(
            m => m.WeddingInquiriesComponent
          ),
      },
      {
        path: 'services/weddings',
        data: { analytics: { eligible: true, pageCategory: 'service' } },
        loadComponent: () =>
          import('./components/public/wedding-services/wedding-services.component').then(
            m => m.WeddingServicesComponent
          ),
      },
      {
        path: 'services/general',
        data: { analytics: { eligible: true, pageCategory: 'service' } },
        loadComponent: () =>
          import('./components/public/general-services/general-services.component').then(
            m => m.GeneralServicesComponent
          ),
      },
      {
        path: 'workshops',
        data: { analytics: { eligible: true, pageCategory: 'workshop' } },
        loadComponent: () =>
          import('./components/public/workshops/workshops.component').then(m => m.WorkshopsComponent),
      },
      {
        path: 'testimonials',
        data: { analytics: { eligible: true, pageCategory: 'testimonials' } },
        loadComponent: () =>
          import('./components/public/testimonials/testimonials.component').then(
            m => m.TestimonialsComponent
          ),
      },
      {
        path: 'privacy-policy',
        data: { analytics: { eligible: true, pageCategory: 'privacy' } },
        loadComponent: () =>
          import('./components/public/privacy-policy/privacy-policy.component').then(
            m => m.PrivacyPolicyComponent
          ),
      },
      {
        path: 'terms-and-conditions',
        data: { analytics: { eligible: true, pageCategory: 'terms' } },
        loadComponent: () =>
          import('./components/public/terms-and-conditions/terms-and-conditions.component').then(
            m => m.TermsAndConditionsComponent
          ),
      },
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./components/public/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'password-recovery',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./components/public/password-recovery/password-recovery.component').then(
            m => m.PasswordRecoveryComponent
          ),
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./components/public/change-password/change-password.component').then(
            m => m.ChangePasswordComponent
          ),
      },
    ],
  },
  {
    path: 'admin',
    component: PrivateLayoutComponent,
    canActivate: [authGuard, adminRoleGuard],
    canActivateChild: [authChildGuard, adminRoleChildGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/private/dashboard/dashboard.component').then(
            m => m.DashboardComponent
          ),
      },
      {
        path: 'leads',
        pathMatch: 'full',
        loadComponent: () =>
          import('./components/private/leads/leads.component').then(m => m.LeadsComponent),
      },
      {
        path: 'leads/:leadId/floral-proposal-builder',
        loadComponent: () =>
          import('./components/private/floral-proposal-builder/floral-proposal-builder.component').then(
            m => m.FloralProposalBuilderComponent
          ),
      },
      {
        path: 'leads/:leadId',
        loadComponent: () =>
          import('./components/private/leads/lead-detail/lead-detail.component').then(m => m.LeadDetailComponent),
      },
      {
        path: 'contacts',
        loadComponent: () =>
          import('./components/private/contacts/contacts.component').then(m => m.ContactsComponent),
      },
      {
        path: 'contacts/:contactId',
        loadComponent: () =>
          import('./components/private/contacts/contacts.component').then(m => m.ContactsComponent),
      },
      {
        path: 'organizations',
        loadComponent: () =>
          import('./components/private/organizations/organizations.component').then(
            m => m.OrganizationsComponent
          ),
      },
      {
        path: 'organizations/:organizationId',
        loadComponent: () =>
          import('./components/private/organizations/organizations.component').then(
            m => m.OrganizationsComponent
          ),
      },
      {
        path: 'catalog-items',
        loadComponent: () =>
          import('./components/private/catalog-items/catalog-items.component').then(
            m => m.CatalogItemsComponent
          ),
      },
      {
        path: 'catalog-items/:itemId',
        loadComponent: () =>
          import('./components/private/catalog-items/catalog-items.component').then(
            m => m.CatalogItemsComponent
          ),
      },
      {
        path: 'tax-regions',
        loadComponent: () =>
          import('./components/private/tax-regions/tax-regions.component').then(
            m => m.TaxRegionsComponent
          ),
      },
      {
        path: 'tax-regions/:taxRegionId',
        loadComponent: () =>
          import('./components/private/tax-regions/tax-regions.component').then(
            m => m.TaxRegionsComponent
          ),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./components/private/projects/projects.component').then(m => m.ProjectsComponent),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./components/private/payments/payments.component').then(m => m.PaymentsComponent),
      },
      {
        path: 'projects/:projectId/proposal-revision',
        loadComponent: () =>
          import('./components/private/floral-proposal-builder/floral-proposal-builder.component').then(
            m => m.FloralProposalBuilderComponent
          ),
      },
      {
        path: 'projects/:projectId',
        loadComponent: () =>
          import('./components/private/projects/project-details/project-details.component').then(
            m => m.ProjectDetailsComponent
          ),
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./components/private/tasks/tasks.component').then(m => m.TasksComponent),
      },
    ],
  },
  {
    path: '**',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        data: { analytics: { eligible: true, pageCategory: 'not_found' } },
        loadComponent: () =>
          import('./components/public/not-found/not-found.component').then(
            m => m.NotFoundComponent
          ),
      },
    ],
  },
];





