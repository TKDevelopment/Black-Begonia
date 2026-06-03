import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { WeddingServicesComponent } from './wedding-services.component';

describe('WeddingServicesComponent', () => {
  let component: WeddingServicesComponent;
  let fixture: ComponentFixture<WeddingServicesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeddingServicesComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeddingServicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
