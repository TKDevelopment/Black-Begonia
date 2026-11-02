import { FormControl } from '@angular/forms';
import { externalCheckoutUrlValidator, isExternalCheckoutUrl } from './workshop-checkout';

describe('workshop external checkout URLs', () => {
  it('accepts full HTTPS ticket links with paths, query strings, and fragments', () => {
    expect(isExternalCheckoutUrl('https://tickets.venue.com/events/flowers?date=2026-11-02#reserve')).toBeTrue();
    expect(externalCheckoutUrlValidator(new FormControl('  https://venue.com/tickets  '))).toBeNull();
    expect(externalCheckoutUrlValidator(new FormControl('  '))).toBeNull();
  });

  it('rejects unsafe schemes, credentials, malformed links, and oversized URLs', () => {
    for (const url of [
      'javascript:alert(1)', 'http://venue.com', '//venue.com', '/tickets',
      'https://user:password@venue.com', 'https://venue.com\\evil',
      'https://venue.com/a b', 'https://', 'https://venue.com:99999',
      'https://venue.com/' + 'a'.repeat(2048),
    ]) {
      expect(isExternalCheckoutUrl(url)).withContext(url).toBeFalse();
      expect(externalCheckoutUrlValidator(new FormControl(url))).withContext(url).not.toBeNull();
    }
  });
});
