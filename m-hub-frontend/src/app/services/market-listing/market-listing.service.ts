import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateMarketListing, MarketListing } from '../../models/market-listing';
import { MaterialType } from '../../enums/material-type.enum';
import { ObjectType } from '../../enums/object-type';

export type MarketListingCategoryFilter =
  | { kind: 'material'; value: MaterialType }
  | { kind: 'object'; value: ObjectType };

@Injectable({
  providedIn: 'root'
})
export class MarketListingService {

  private readonly apiUrl = 'http://localhost:1880/api/market-listings';  // Node-RED route for Market Listings

  constructor(private http: HttpClient) { }

  getMarketListingById(marketListingId: string): Observable<MarketListing> {
    return this.http.get<MarketListing>(`${this.apiUrl}/${marketListingId}`);
  }

  // getMarketListingByCategory(marketListingCategory: string): Observable<MarketListing> {
  //   return this.http.get<MarketListing>(`${this.apiUrl}/category/${marketListingCategory}`);
  // }

  getMarketListingsByCategory(filter: MarketListingCategoryFilter): Observable<MarketListing[]> {
    let params = new HttpParams();

    if (filter.kind === 'material') {
      params = params.set('material', filter.value);
    } else {
      params = params.set('object_type', filter.value);
    }

    return this.http.get<MarketListing[]>(this.apiUrl, { params });
  }

  addMarketListing(payload: CreateMarketListing): Observable<MarketListing> {
    return this.http.post<MarketListing>(this.apiUrl, payload);
  }
}
