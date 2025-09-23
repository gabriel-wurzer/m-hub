import { Injectable } from '@angular/core';
import 'leaflet-control-geocoder';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { Building } from '../../models/building';


@Injectable({
  providedIn: 'root'
})
export class MapService {

  private readonly postGisBaseUrl = 'http://128.131.21.198:3002/v1';

  constructor(private http: HttpClient) {}

  /**
   * Generates a new vector tile URL string. URL resolved by Dirt Postgis API which connects to a PostgreSql DB 
   * @param table Database table name.
   * @param columns [optional] Database columns to be returned.
   * @param filter [optional] SQL WHERE clause.
   * @returns Vector tile URL as string.
   */
  getVectorTileUrl(table: string, columns: string[], filter?: string): string {
    let url = `${this.postGisBaseUrl}/mvt/${table}/{z}/{x}/{y}`;
    const params: string[] = [];

    if (columns?.length) params.push('columns=' + columns.join(','));
    if (filter) params.push('filter=' + encodeURIComponent(filter));
    if (params.length) url += '?' + params.join('&');

    return url;
  }

  /**
   * Fetch detailed building data by ID
   * @param table Database table name for buildings.
   * @param id Key for the building to fetch. 
   * @param columns [optional] Database columns to be returned.
   * @returns Vector tile URL as string.
   */
  getBuildingById(table: string, id: string, columns: string[]): Observable<Building> {
    const url = `${this.postGisBaseUrl}/query/${table}`;
    const params = new HttpParams()
      .set('columns', columns.join(','))
      .set('filter', `bw_geb_id = '${id}'`);

    return this.http.get<Building[]>(url, { params }).pipe(
      map(res => Array.isArray(res) ? res[0] : res)
    );
  }

  /**
   * Fetch a building intersecting with the given latitude/longitude point from PostGIS API.
   * Uses point-in-polygon intersection to identify the building.
   * @param lat Latitude in WGS84 (EPSG:4326).
   * @param lng Longitude in WGS84 (EPSG:4326).
   * @param columns List of database columns to be returned in the response.
   * @returns Observable that emits a Building object if a building is found, or null if no building was found.
   */
  getBuildingFromLatLng(lat: number, lng: number, columns: string[]): Observable<Building | null> {
    const srid = 4326;
    const point = `${lng},${lat},${srid}`;
    const table = 'buildings_details';
    const url = `${this.postGisBaseUrl}/intersect_point/${table}/${point}`;
    const params = new HttpParams().set('columns', columns.join(','));
    
    return this.http.get<Building[]>(url, { params }).pipe(
      map((data) => (Array.isArray(data) ? data[0] : data) ?? null),
      catchError((err) => {
        console.error("Error fetching building from point:", err);
        return of(null);
      })
    );
  }


 /**
   * Search addresses using the Nominatim API with location bias for Vienna, Austria.
   * Returns structured address results formatted for Leaflet geocoder.
   * @param query Search query string (e.g., street, building, or address).
   * @returns Observable emitting an array of formatted address search results.
   */
  searchAddress(query: string): Observable<any[]> {
    const url = `https://nominatim.openstreetmap.org/search`;
    const params = new HttpParams()
      .set('format', 'json')
      .set('limit', '5')
      .set('q', `${query}, Vienna`)
      .set('countrycodes', 'AT');

    return this.http.get<any[]>(url, { params }).pipe(
      map((results) => results.map((result: any) => {
        const parts: string[] = result.display_name.split(',').map((p: string) => p.trim());
        const name = parts[0] || '';
        const addressDetail = parts.slice(1, 4).join(', ') || '';
        let city = '';
        if (parts.length === 8) city = parts.slice(5, 7).join(', ');
        else if (parts.length === 7) city = parts.slice(4, 6).join(', ');
        else if (parts.length === 6) city = parts.slice(3, 5).join(', ');
        else city = parts.slice(parts.length - 3, parts.length - 1).join(', ');

        return {
          name,
          center: [parseFloat(result.lat), parseFloat(result.lon)],
          bbox: [
            [parseFloat(result.boundingbox[0]), parseFloat(result.boundingbox[2])],
            [parseFloat(result.boundingbox[1]), parseFloat(result.boundingbox[3])]
          ],
          html: `
            <li>
              <a href="#" onclick="return false;">
                ${name} <br>
                <span class="leaflet-control-geocoder-address-detail">
                  ${addressDetail}
                </span><br>
                <span class="leaflet-control-geocoder-address-context">
                  ${city}
                </span>
              </a>
            </li>
          `
        };
      }))
    );
  }

}
