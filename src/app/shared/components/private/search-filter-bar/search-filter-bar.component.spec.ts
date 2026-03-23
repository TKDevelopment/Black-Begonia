import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchFilterBarComponent } from './search-filter-bar.component';

describe('SearchFilterBarComponent', () => {
  let component: SearchFilterBarComponent;
  let fixture: ComponentFixture<SearchFilterBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchFilterBarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchFilterBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
