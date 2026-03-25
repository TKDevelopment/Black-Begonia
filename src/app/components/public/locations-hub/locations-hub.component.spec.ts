import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocationsHubComponent } from './locations-hub.component';

describe('LocationsHubComponent', () => {
  let component: LocationsHubComponent;
  let fixture: ComponentFixture<LocationsHubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationsHubComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LocationsHubComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
