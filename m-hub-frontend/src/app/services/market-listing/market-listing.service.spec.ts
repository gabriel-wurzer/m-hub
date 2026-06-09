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

    const request = httpMock.expectOne('/api/market-listing/categories/counts');
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

  it('searches market listings by query text', () => {
    service.searchMarketListings(' Beton ').subscribe(listings => {
      expect(listings).toEqual([]);
    });

    const request = httpMock.expectOne(req => req.url === '/api/market-listings/search');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('Beton');

    request.flush([]);
  });

  it('does not request market listing search for empty query text', () => {
    service.searchMarketListings('   ').subscribe(listings => {
      expect(listings).toEqual([]);
    });

    httpMock.expectNone('/api/market-listings/search');
  });

  it('requests similar market listings in a radius', () => {
    service.getSimilarMarketListingsInRadius('listing-1', 2000).subscribe(listings => {
      expect(listings.map(listing => listing.id)).toEqual(['listing-2']);
    });

    const request = httpMock.expectOne(req => req.url === '/api/similar-market-listings/listing-1');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('radius')).toBe('2000');

    request.flush([
      { id: 'listing-2', created_at: '2026-05-01T00:00:00Z' },
      { id: 'listing-2', created_at: '2026-05-01T00:00:00Z' }
    ]);
  });

  it('deletes market listings by id', () => {
    service.deleteMarketListing('listing-1').subscribe(listing => {
      expect(listing.id).toBe('listing-1');
    });

    const request = httpMock.expectOne('/api/market-listings/listing-1');
    expect(request.request.method).toBe('DELETE');

    request.flush({ id: 'listing-1' });
  });

  it('updates market listings by id', () => {
    const payload = {
      name: 'Updated listing',
      description: 'Updated description',
      price: 120,
      potential: 'reuse' as any,
      quantity: 2,
      unit: 'StÃ¼ck' as any,
      status: 'eingelagert' as any,
      available_from: '2026-05-05',
      contact: 'user@example.com',
      length: null,
      width: null,
      height: null
    };

    service.updateMarketListing('listing-1', payload).subscribe(listing => {
      expect(listing.id).toBe('listing-1');
    });

    const request = httpMock.expectOne('/api/market-listings/listing-1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);

    request.flush({ id: 'listing-1' });
  });
});
