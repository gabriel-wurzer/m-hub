import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { CreateMarketListing, MarketListing, SimilarMarketListing, UpdateMarketListing } from '../../models/market-listing';
import { MaterialType } from '../../enums/material-type.enum';
import { ObjectType } from '../../enums/object-type';
import { MaterialGroup } from '../../enums/material-group';

export type MarketListingCategoryFilter =
  | { kind: 'material'; value: MaterialType }
  | { kind: 'materialGroup'; value: MaterialGroup }
  | { kind: 'object'; value: ObjectType };

export type MarketListingCategoryCount = {
  kind: 'material' | 'object';
  value: MaterialGroup | ObjectType;
  count: number;
};

export type SimilarMarketListingRadius = 500 | 1000 | 2000 | 5000;

@Injectable({
  providedIn: 'root'
})
export class MarketListingService {

  private readonly apiUrl = '/api/market-listings';  // Node-RED route for Market Listings

  constructor(private http: HttpClient) { }

  getMarketListingById(marketListingId: string): Observable<MarketListing> {
    return this.http.get<MarketListing>(`${this.apiUrl}/${marketListingId}`);
  }

  getMarketListingCategoryCounts(): Observable<MarketListingCategoryCount[]> {
    return this.http.get<MarketListingCategoryCount[]>('/api/market-listing/categories/counts');
  }

  // getMarketListingByCategory(marketListingCategory: string): Observable<MarketListing> {
  //   return this.http.get<MarketListing>(`${this.apiUrl}/category/${marketListingCategory}`);
  // }

  getMarketListingsByCategory(filter: MarketListingCategoryFilter): Observable<MarketListing[]> {
    let params = new HttpParams();

    if (filter.kind === 'material') {
      params = params.set('material', filter.value);
    } else if (filter.kind === 'materialGroup') {
      params = params.set('material_group', filter.value);
    } else {
      params = params.set('object_type', filter.value);
    }

    return this.http.get<MarketListing[]>(this.apiUrl, { params });
  }

  getMarketListingsByMaterialGroup(group: MaterialGroup): Observable<MarketListing[]> {
    return this.getMarketListingsByCategory({ kind: 'materialGroup', value: group }).pipe(
      map(listings => this.sortAndDedupeListings(listings))
    );
  }

  getMarketListingsByObjectType(objectType: ObjectType): Observable<MarketListing[]> {
    return this.getMarketListingsByCategory({ kind: 'object', value: objectType }).pipe(
      map(listings => this.sortAndDedupeListings(listings))
    );
  }

  getMarketListingsByOwnerId(ownerId: string): Observable<MarketListing[]> {
    const params = new HttpParams().set('owner_id', ownerId);

    return this.http.get<MarketListing[]>(this.apiUrl, { params }).pipe(
      map(listings => this.sortAndDedupeListings(listings))
    );
  }

  getSimilarMarketListingsInRadius(
    marketListingId: string,
    radiusMeters: SimilarMarketListingRadius
  ): Observable<SimilarMarketListing[]> {
    const params = new HttpParams().set('radius', String(radiusMeters));

    return this.http.get<SimilarMarketListing[]>(`/api/similar-market-listings/${marketListingId}`, { params }).pipe(
      map(listings => this.dedupeListings(listings))
    );
  }

  addMarketListing(payload: CreateMarketListing): Observable<MarketListing> {
    return this.http.post<MarketListing>(this.apiUrl, payload);
  }

  updateMarketListing(marketListingId: string, payload: UpdateMarketListing): Observable<MarketListing> {
    return this.http.put<MarketListing>(`${this.apiUrl}/${marketListingId}`, payload);
  }

  deleteMarketListing(marketListingId: string): Observable<MarketListing> {
    return this.http.delete<MarketListing>(`${this.apiUrl}/${marketListingId}`);
  }

  private dedupeListings<T extends Pick<MarketListing, 'id'>>(listings: T[]): T[] {
    const uniqueById = new Map<string, T>();

    for (const listing of listings) {
      if (!uniqueById.has(listing.id)) {
        uniqueById.set(listing.id, listing);
      }
    }

    return Array.from(uniqueById.values());
  }

  private sortAndDedupeListings(listings: MarketListing[]): MarketListing[] {
    const uniqueById = new Map<string, MarketListing>();

    for (const listing of listings) {
      uniqueById.set(listing.id, listing);
    }

    return Array.from(uniqueById.values()).sort((left, right) => {
      const leftTime = Date.parse(left.created_at ?? '') || 0;
      const rightTime = Date.parse(right.created_at ?? '') || 0;
      return rightTime - leftTime;
    });
  }
}
