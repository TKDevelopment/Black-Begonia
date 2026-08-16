const WORKSHOP_FEATURE_SURFACES = [
  'app-workshops',
  'app-workshop-detail',
  'app-workshop-terms-and-conditions',
  'app-workshop-reservation',
  'app-workshop-booking-status',
  'app-admin-workshops',
  'app-workshop-editor',
  'app-workshop-customer-preview',
  'app-workshop-occurrence-detail',
  'app-workshop-roster',
  'app-workshop-financials',
  'app-workshop-data-retention-policy',
  'app-payment-options',
  'app-payment-status',
  'app-payments',
  'app-payment-obligation-modal',
  'app-payment-settings-modal',
] as const;

describe('workshop feature responsive layout contract', () => {
  const mounted: HTMLElement[] = [];

  afterEach(() => {
    mounted.splice(0).forEach(element => element.remove());
  });

  it('registers every workshop, booking, CRM, and payment surface', () => {
    for (const selector of WORKSHOP_FEATURE_SURFACES) {
      const host = document.createElement(selector);
      mounted.push(host);
      document.body.appendChild(host);

      const styles = getComputedStyle(host);
      expect(styles.display).withContext(selector).toBe('block');
      expect(styles.minWidth).withContext(selector).toBe('0px');
      expect(styles.maxWidth).withContext(selector).toBe('100%');
      expect(styles.getPropertyValue('--workshop-responsive-contract').trim())
        .withContext(selector)
        .toBe('phone-tablet-laptop-desktop-ultrawide');
    }
  });

  it('keeps long customer and operational copy breakable', () => {
    const host = document.createElement('app-workshop-detail');
    const heading = document.createElement('h1');
    heading.textContent = 'An-extremely-long-workshop-title-that-must-not-overflow';
    host.appendChild(heading);
    mounted.push(host);
    document.body.appendChild(host);

    expect(getComputedStyle(heading).overflowWrap).toBe('anywhere');
  });

  it('keeps dense CRM tables inside horizontally scrollable regions', () => {
    for (const selector of [
      'app-workshop-roster',
      'app-workshop-financials',
      'app-workshop-data-retention-policy',
    ]) {
      const host = document.createElement(selector);
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrap';
      host.appendChild(wrapper);
      mounted.push(host);
      document.body.appendChild(host);

      const styles = getComputedStyle(wrapper);
      expect(styles.maxWidth).withContext(selector).toBe('100%');
      expect(styles.overflowX).withContext(selector).toBe('auto');
      expect(styles.overscrollBehaviorX).withContext(selector).toBe('contain');
    }
  });

  it('contains long-form operational content at the active viewport', () => {
    const host = document.createElement('app-workshop-data-retention-policy');
    const page = document.createElement('main');
    page.className = 'policy-page';
    const heading = document.createElement('h1');
    heading.textContent = 'Privacy-and-retention-administration-with-an-unusually-long-title';
    page.appendChild(heading);
    host.appendChild(page);
    mounted.push(host);
    document.body.appendChild(host);

    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth + 1);
    expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth + 1);
  });

  it('presents upcoming workshop dates as touch-friendly editorial cards on phones', () => {
    const host = document.createElement('app-workshops');
    const page = document.createElement('main');
    page.className = 'workshops-page';
    const list = document.createElement('div');
    list.className = 'workshop-list';
    const row = document.createElement('article');
    row.className = 'workshop-row';
    const date = document.createElement('div');
    date.className = 'date-block';
    const image = document.createElement('img');
    const copy = document.createElement('div');
    copy.className = 'workshop-copy';
    const action = document.createElement('div');
    action.className = 'workshop-action';
    const detailLink = document.createElement('a');
    detailLink.className = 'details-button';
    action.appendChild(detailLink);
    row.append(date, image, copy, action);
    list.appendChild(row);
    page.appendChild(list);
    host.appendChild(page);
    mounted.push(host);
    document.body.appendChild(host);

    if (window.matchMedia('(max-width: 640px)').matches) {
      const rowStyles = getComputedStyle(row);
      expect(rowStyles.getPropertyValue('--workshop-mobile-layout').trim())
        .toBe('editorial-event-card');
      expect(rowStyles.position).toBe('relative');
      expect(rowStyles.overflow).toBe('hidden');
      expect(Number.parseFloat(rowStyles.borderRadius)).toBeGreaterThan(0);
      expect(getComputedStyle(date).position).toBe('absolute');
      expect(image.clientWidth).toBeGreaterThanOrEqual(row.clientWidth - 1);
      expect(detailLink.clientWidth).toBeGreaterThanOrEqual(row.clientWidth * .8);
    } else {
      expect(getComputedStyle(row).getPropertyValue('--workshop-mobile-layout').trim())
        .toBe('');
    }
  });

  it('keeps only ten pixels between detail breadcrumbs and the hero on phones', () => {
    const host = document.createElement('app-workshop-detail');
    const page = document.createElement('main');
    page.className = 'detail-page';
    const breadcrumb = document.createElement('nav');
    breadcrumb.className = 'breadcrumb';
    const hero = document.createElement('header');
    hero.className = 'hero';
    page.append(breadcrumb, hero);
    host.appendChild(page);
    mounted.push(host);
    document.body.appendChild(host);

    if (window.matchMedia('(max-width: 640px)').matches) {
      expect(getComputedStyle(breadcrumb).marginBottom).toBe('10px');
    } else {
      expect(getComputedStyle(breadcrumb).marginBottom).toBe('0px');
    }
  });
});
