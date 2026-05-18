import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketListingComponent } from './market-listing.component';

describe('MarketListingComponent', () => {
  let component: MarketListingComponent;
  let fixture: ComponentFixture<MarketListingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketListingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketListingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
