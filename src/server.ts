import { CommonEngine } from '@angular/ssr/node';
import { render } from '@netlify/angular-runtime/common-engine.mjs';

const commonEngine = new CommonEngine();
const runtimeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env ?? {};

export async function resolveWorkshopRedirect(
  pathname: string,
  env: Record<string, string | undefined> = runtimeEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const match = pathname.match(/^\/workshops\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (!match || !env['SUPABASE_URL'] || !env['SUPABASE_ANON_KEY']) return null;

  try {
    const response = await fetchImpl(
      `${env['SUPABASE_URL']}/rest/v1/rpc/get_public_workshop_occurrence`,
      {
        method: 'POST',
        headers: {
          apikey: env['SUPABASE_ANON_KEY'],
          Authorization: `Bearer ${env['SUPABASE_ANON_KEY']}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_slug: match[1] }),
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!response.ok) return null;
    const occurrence = await response.json() as {
      seoStatus?: string;
      redirectUrl?: string;
    } | null;
    return occurrence?.seoStatus === 'redirect'
      && /^\/workshops(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(occurrence.redirectUrl ?? '')
      ? occurrence.redirectUrl!
      : null;
  } catch {
    return null;
  }
}

export async function netlifyCommonEngineHandler(request: Request, context: any): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/api/analytics-region') {
    const production = url.origin === 'https://blackbegoniaflorals.com';
    const countryCode = String(
      context?.geo?.country?.code ?? context?.geo?.country?.code3 ?? ''
    ).toUpperCase();
    const region = countryCode === 'US' || countryCode === 'USA'
      ? 'us'
      : countryCode
        ? 'non_us'
        : 'unknown';

    return Response.json(
      {
        region,
        gpc: request.headers.get('Sec-GPC') === '1',
        production,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
          'Content-Type': 'application/json; charset=utf-8',
          Vary: 'Sec-GPC',
        },
      }
    );
  }

  const redirect = await resolveWorkshopRedirect(url.pathname);
  if (redirect) {
    return new Response(null, {
      status: 308,
      headers: {
        Location: new URL(redirect, url.origin).toString(),
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  return await render(commonEngine);
}
