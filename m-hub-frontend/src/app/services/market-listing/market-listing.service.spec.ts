import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { MarketListingService } from './market-listing.service';

describe('MarketListingService', () => {
  let service: MarketListingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(MarketListingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
