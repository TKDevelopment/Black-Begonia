import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingStateBlockComponent } from './loading-state-block.component';

describe('LoadingStateBlockComponent', () => {
  let component: LoadingStateBlockComponent;
  let fixture: ComponentFixture<LoadingStateBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingStateBlockComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoadingStateBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
