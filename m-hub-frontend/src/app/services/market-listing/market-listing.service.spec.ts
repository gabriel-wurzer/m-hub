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

  it('requests material group listings with one material_group request', () => {
    service.getMarketListingsByMaterialGroup(MaterialGroup.Mineralik).subscribe(listings => {
      expect(listings).toEqual([]);
    });

    const requests = httpMock.match(request => request.url === '/api/market-listings');

    expect(requests.length).toBe(1);
    expect(requests[0].request.method).toBe('GET');
    expect(requests[0].request.params.get('material_group')).toBe(MaterialGroup.Mineralik);
    expect(requests[0].request.params.has('material')).toBeFalse();

    requests[0].flush([]);
  });

  it('requests market listings by owner id', () => {
    service.getMarketListingsByOwnerId('user-1').subscribe(listings => {
      expect(listings).toEqual([]);
    });

    const request = httpMock.expectOne(req => req.url === '/api/market-listings');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('owner_id')).toBe('user-1');

    request.flush([]);
  });

  it('deletes market listings by id', () => {
    service.deleteMarketListing('listing-1').subscribe(listing => {
      expect(listing.id).toBe('listing-1');
    });

    const request = httpMock.expectOne('/api/market-listings/listing-1');
    expect(request.request.method).toBe('DELETE');

    request.flush({ id: 'listing-1' });
  });
});
