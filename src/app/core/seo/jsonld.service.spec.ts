import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { JsonLdService } from './jsonld.service';

describe('JsonLdService', () => {
  let service: JsonLdService;
  let document: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(JsonLdService);
    document = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    document.getElementById('schema-local-business')?.remove();
  });

  it('publishes the canonical Instagram account in local business structured data', () => {
    service.setLocalBusiness();

    const script = document.getElementById('schema-local-business') as HTMLScriptElement;
    const schema = JSON.parse(script.text) as { sameAs: string[] };

    expect(schema.sameAs).toContain('https://www.instagram.com/blackbegoniaflorals/');
    expect(schema.sameAs).not.toContain('https://www.instagram.com/blackbegoniaflorist/');
  });
});
