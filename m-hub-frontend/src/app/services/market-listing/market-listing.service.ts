import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { CreateMarketListing, MarketListing } from '../../models/market-listing';
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
    return this.http.get<MarketListingCategoryCount[]>(`${this.apiUrl}/counts`);
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

  addMarketListing(payload: CreateMarketListing): Observable<MarketListing> {
    return this.http.post<MarketListing>(this.apiUrl, payload);
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
