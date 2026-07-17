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

  it('does not expose retired public proposal access routes', () => {
    const publicPaths = routes.map((route) => route.path);
    const wildcardRoute = routes.find((route) => route.path === '**');

    expect(publicPaths).not.toContain('proposal');
    expect(publicPaths).not.toContain('proposal/auth');
    expect(wildcardRoute).toBeDefined();
    expect(typeof wildcardRoute?.loadComponent).toBe('function');
  });
});
