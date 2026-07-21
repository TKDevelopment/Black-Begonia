import { routes } from './app.routes';

describe('app routes', () => {
  it('does not expose retired proposal template admin routes', () => {
    const adminRoutes = routes.find((route) => route.path === 'admin')?.children ?? [];
    const adminPaths = adminRoutes.map((route) => route.path);

    expect(adminPaths).not.toContain('proposal-templates');
    expect(adminPaths).not.toContain('proposal-templates/:templateId/studio');
  });

  it('keeps the floral proposal builder route available from lead detail', () => {
    const adminRoutes = routes.find((route) => route.path === 'admin')?.children ?? [];
    const builderRoute = adminRoutes.find(
      (route) => route.path === 'leads/:leadId/floral-proposal-builder'
    );

    expect(builderRoute).toBeDefined();
    expect(typeof builderRoute?.loadComponent).toBe('function');
  });

  it('registers separate projects list and project details routes', () => {
    const adminRoutes = routes.find((route) => route.path === 'admin')?.children ?? [];
    const projectsRoute = adminRoutes.find((route) => route.path === 'projects');
    const projectDetailsRoute = adminRoutes.find((route) => route.path === 'projects/:projectId');

    expect(projectsRoute).toBeDefined();
    expect(typeof projectsRoute?.loadComponent).toBe('function');
    expect(projectDetailsRoute).toBeDefined();
    expect(typeof projectDetailsRoute?.loadComponent).toBe('function');
  });

  it('does not expose retired public proposal access routes', () => {
    const publicPaths = routes.map((route) => route.path);
    const wildcardRoute = routes.find((route) => route.path === '**');

    expect(publicPaths).not.toContain('proposal');
    expect(publicPaths).not.toContain('proposal/auth');
    expect(wildcardRoute).toBeDefined();
    expect(wildcardRoute?.component).toBeDefined();
    expect(typeof wildcardRoute?.children?.[0]?.loadComponent).toBe('function');
  });

  it('keeps customer payment routes isolated and never defines a payment details route', () => {
    const paymentLayoutRoute = routes.find((route) => route.path === 'pay');
    const paymentRoute = paymentLayoutRoute?.children?.find((route) => route.path === ':token');
    const statusRoute = paymentLayoutRoute?.children?.find((route) => route.path === ':token/status');
    const adminRoutes = routes.find((route) => route.path === 'admin')?.children ?? [];
    expect(paymentLayoutRoute?.component).toBeDefined();
    expect(paymentLayoutRoute?.data?.['headerMode']).toBe('payment');
    expect(typeof paymentRoute?.loadComponent).toBe('function');
    expect(typeof statusRoute?.loadComponent).toBe('function');
    expect(paymentRoute?.canActivate).toBeUndefined();
    expect(adminRoutes.some((route) => route.path === 'payments')).toBeTrue();
    expect(adminRoutes.some((route) => route.path?.startsWith('payments/:'))).toBeFalse();
  });

  it('renders the wildcard not-found page inside the public layout', () => {
    const wildcardRoute = routes.find((route) => route.path === '**');
    const notFoundPage = wildcardRoute?.children?.find((route) => route.path === '');

    expect(wildcardRoute?.component).toBeDefined();
    expect(typeof notFoundPage?.loadComponent).toBe('function');
  });
});
