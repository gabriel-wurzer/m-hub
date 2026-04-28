import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { MarketListingService } from './market-listing.service';
import { MaterialGroup } from '../../enums/material-group';

describe('MarketListingService', () => {
  let service: MarketListingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(MarketListingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('requests market listing category counts', () => {
    service.getMarketListingCategoryCounts().subscribe(counts => {
      expect(counts).toEqual([{ kind: 'material', value: MaterialGroup.Mineralik, count: 2 }]);
    });

    const request = httpMock.expectOne('/api/market-listings/counts');
    expect(request.request.method).toBe('GET');
    request.flush([{ kind: 'material', value: 'Mineralik', count: 2 }]);
  });
});
