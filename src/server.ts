import { CommonEngine } from '@angular/ssr/node';
import { render } from '@netlify/angular-runtime/common-engine.mjs';

const commonEngine = new CommonEngine();

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

  return await render(commonEngine);
}
