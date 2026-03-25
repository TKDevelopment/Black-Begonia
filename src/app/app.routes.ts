import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './core/layouts/public-layout/public-layout.component';
import { PrivateLayoutComponent } from './core/layouts/private-layout/private-layout.component';
import { LandingComponent } from './components/public/landing/landing.component';
import { authGuard, authChildGuard } from './core/guards/auth.guard';
import { adminRoleGuard, adminRoleChildGuard } from './core/guards/admin-role.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', component: LandingComponent },

      {
        path: 'about',
        loadComponent: () =>
          import('./components/public/about/about.component').then(m => m.AboutComponent),
      },
      {
        path: 'portfolio',
        loadComponent: () =>
          import('./components/public/portfolio/portfolio.component').then(m => m.PortfolioComponent),
      },
      {
        path: 'portfolio/:slug',
        loadComponent: () =>
          import('./components/public/portfolio-detail/portfolio-detail.component').then(
            m => m.PortfolioDetailComponent
          ),
      },
      {
        path: 'locations',
        loadComponent: () =>
          import('./components/public/locations-hub/locations-hub.component').then(
            (m) => m.LocationsHubComponent
          )
      },
      {
        path: 'locations/:slug',
        loadComponent: () =>
          import('./components/public/locations/locations.component').then(
            (m) => m.LocationsComponent
          )
      },
      {
        path: 'inquiries',
        loadComponent: () =>
          import('./components/public/inquiries/inquiries.component').then(m => m.InquiriesComponent),
      },
      {
        path: 'inquiries/success',
        loadComponent: () =>
          import('./components/public/inquiries/inquiry-success/inquiry-success.component').then(
            m => m.InquirySuccessComponent
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
          import('./components/public/workshops/workshops.component').then(m => m.WorkshopsComponent),
      },
      {
        path: 'testimonials',
        loadComponent: () =>
          import('./components/public/testimonials/testimonials.component').then(
            m => m.TestimonialsComponent
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
        loadComponent: () =>
          import('./components/private/leads/leads.component').then(m => m.LeadsComponent),
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
        path: 'projects',
        loadComponent: () =>
          import('./components/private/projects/projects.component').then(m => m.ProjectsComponent),
      },
      {
        path: 'projects/:projectId',
        loadComponent: () =>
          import('./components/private/projects/projects.component').then(m => m.ProjectsComponent),
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
    redirectTo: '',
  },
];