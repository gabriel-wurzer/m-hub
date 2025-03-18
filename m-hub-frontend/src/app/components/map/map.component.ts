import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet.vectorgrid';
import 'leaflet-control-geocoder';


import { Building } from '../../models/building';
import { environment } from '../../../environments/environment';
import { FilterMenuComponent } from "../filter-menu/filter-menu.component";
import { FilterButtonComponent } from "../buttons/filter-button/filter-button.component";


@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FilterMenuComponent, FilterButtonComponent],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit {

  #map!: L.Map;
  #vectorGridLayer: L.VectorGrid.Protobuf | null = null;
  #highlightedFeatureLayer: L.GeoJSON | null = null;
  #markerLayer: L.Marker | null = null;


  #selectedBuildingID: number | null = null;
  selectedBuilding!: number;
  #buildingClicked = false;

  #tableName = 'buildings_details';
  #defaultColumns = ['bw_geb_id','ST_AsGeoJSON(geom) as geometry'];

  isFilterPanelVisible = false;

  constructor() {}

  ngOnInit(): void {
    this.#initMap();
  }

  /**
   * Initialize the map and set up base layers.
   * Bounds and view set for Vienna.
   * Use Mapbox baselayer
   */
  #initMap(): void {

    this.#map = L.map('map', {
      minZoom: 12,
      maxZoom: 22,
      zoomControl: false
    })
    .setView([48.2082, 16.3738], 13); // Vienna coordinates

    L.control.zoom({
      position: 'topright',
    }).addTo(this.#map);

    const bounds = L.latLngBounds([48.51, 17.35], [47.93, 15.41]);
    this.#map.setMaxBounds(bounds);

    L.tileLayer('/mapbox/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
      minZoom: 12,
      maxZoom: 22,  // 19
      attribution: '© <a href="https://www.mapbox.com/">Mapbox</a>',
      id: "simlabtuwien/cm3r2nlew003y01s6g5gtfwtd",
      accessToken: environment.mapboxToken
    }).addTo(this.#map);


    this.#initVectorGridLayer();
    this.#initGeocoder();

    this.#map.on('click', () => {

      if (this.#markerLayer) {
        this.#map.removeLayer(this.#markerLayer);
        this.#markerLayer = null;
      }

      if (!this.#buildingClicked) {
        this.#deselectBuilding();
      }
      this.#buildingClicked = false;
    });

}

#initGeocoder(): void {

  L.Icon.Default.prototype.options.shadowUrl = "";
  L.Icon.Default.prototype.options.shadowSize = [0, 0];

  const geocoderControl = L.Control.geocoder({
    defaultMarkGeocode: false,
    position: 'topleft',
    placeholder: 'Suchen..'
  });


  // Customize geocode method to fetch suggestions dynamically and filter results
  geocoderControl.options.geocoder.geocode = (query: string, cb: any) => {

    // Construct the API URL with query, limiting results to 5, and filtering to Vienna and Austria
    const url = `/nominatim/search?format=json&limit=5&q=${encodeURIComponent(query)}, Vienna&countrycodes=AT`;


    console.log('Nominatim request URL:', url); // Log for debugging

    fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Map the response data to the format expected by the callback
      const results = data.map((result: { display_name: string; lat: string; lon: string; boundingbox: string[]; }) => {
      const parts = result.display_name.split(',').map(part => part.trim());
      
      // Extract fields based on your desired structure
      const name = parts[0] || ''; // Name
      const addressDetail = parts.slice(1, 4).join(', ') || ''; // Address details (fields 1-3)

      // Handle different part lengths for city field
      let city = '';
      if (parts.length === 8) {
        city = parts.slice(5, 7).join(', ') || ''; // Fields 5-6
      } else if (parts.length === 7) {
        city = parts.slice(4, 6).join(', ') || ''; // Fields 4-5
      } else if (parts.length === 6) {
        city = parts.slice(3, 5).join(', ') || ''; // Fields 3-4
      } else {
        city = parts.slice(parts.length-3, parts.length-1).join(', ') || '';
      }

      return {
        name: name,
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
      });

    // Invoke the callback with the processed results
    cb(results);
    })
    .catch(error => {
      console.error('Geocoding request failed:', error);
      cb([]); // Return an empty result array on failure
    });
  };

  geocoderControl.on('markgeocode', (e: any) => {
    
    console.log('Geocode response:', e.geocode);

    const center = e.geocode.center;
    console.log("Geocode result center:", center);

    const latLngCenter = L.latLng(center[0], center[1]);
    console.log('Converted LatLng center:', latLngCenter);

    const zoomLevel = this.#map.getZoom() > 18 ? this.#map.getZoom() : 18; // Zoom to 18 or keep current zoom if >18
    this.#map.setView(center, zoomLevel); // Center the map on the marker position
    
    this.#addSearchMarker(center);

    this.#selectBuildingFromLatLng(latLngCenter);
  })

  geocoderControl.addTo(this.#map);
}


/**
 * Initialize the VectorGrid Layer with default styles and event listeners.
 */
#initVectorGridLayer(): void {
//  private initVectorGridLayer(filter?: string): void {
  if (!this.#map) return;
  
  if (this.#vectorGridLayer) {
    this.#map.removeLayer(this.#vectorGridLayer);
  }

  // let joinTable: undefined;
  // let additionalColumns: string[] = [];
  let filter: string | undefined;
  // let filter = "h_klasse >= " + 8;

  const vectorTileUrl = this.#generateVectorTileUrl(this.#tableName, this.#defaultColumns, filter);

  this.#vectorGridLayer = L.vectorGrid.protobuf(vectorTileUrl, {
    vectorTileLayerStyles: {
      [this.#tableName]: ({
        weight: 2,
        opacity: 0.8,
        fill: true,
        fillOpacity: 0.1,
      })
    },
    interactive: true,
    getFeatureId: (feature: any) => (feature.properties as Building).bw_geb_id, // set building_id as unique feature identifier
  });

  
  this.#vectorGridLayer.addTo(this.#map);

  this.#vectorGridLayer.on('click', (event: any) => {
    this.#buildingClicked = true;
    event.originalEvent.stopPropagation(); // Prevent map click handler
    this.#handleBuildingClick(event);
  });

}

  /**
   * Generates a new vector tile URL string. URL resolved by Dirt Postgis API which connects to a PostgreSql DB 
   * @param table Database table name.
   * @param columns [optional] Database columns to be returned.
   * @param filter [optional] SQL WHERE clause.
   * @returns Vector tile URL as string.
   */
  #generateVectorTileUrl(table: string, columns: string[], filter?:string): string {
    return `http://128.131.21.198:3002/v1/mvt/${table}/{z}/{x}/{y}` + 
    (columns != undefined ? '?columns=' + columns!.join() : '') +
    (filter != undefined ? '&filter=' + filter : '');
  }

  updateFilter(filtervalue: number): void {
    // const filter = this.hKlasseFilter ? `h_klasse > ${this.hKlasseFilter}` : undefined;
    const filter = "h_klasse >= " + filtervalue;
    this.#generateVectorTileUrl(this.#tableName, this.#defaultColumns, filter);
  }

  #handleBuildingClick(event: any): void {
    const properties = event.layer.properties;

    if (properties) {
      const buildingId = parseInt(properties['bw_geb_id']);
      const geometry = JSON.parse(properties['geometry']);

      console.log('Clicked Building ID:', buildingId);
      
      this.#highlightBuilding(geometry, buildingId);
    }
  }

  #highlightBuilding(geometry: any, buildingId: number): void {
    if (this.#highlightedFeatureLayer) {
      this.#map.removeLayer(this.#highlightedFeatureLayer);
      this.#highlightedFeatureLayer = null;
    }

    this.#highlightedFeatureLayer = L.geoJSON(geometry, {
      style: {
        color: '#ff0000',
        weight: 3,
        fill: true,
        fillColor: '#ff0000',
        fillOpacity: 0.5,
      },
    }).addTo(this.#map);

    this.#selectedBuildingID = buildingId;
    this.selectedBuilding = buildingId;

    const bounds = L.geoJSON(geometry).getBounds();
    const currentZoom = this.#map.getZoom();
    const targetZoom = Math.max(currentZoom, 18);
    this.#map.fitBounds(bounds, { maxZoom: targetZoom });
  }

  #deselectBuilding(): void {
    if (this.#highlightedFeatureLayer) {
      this.#map.removeLayer(this.#highlightedFeatureLayer); // Remove highlight layer
      this.#highlightedFeatureLayer = null;
    }
    if (this.#selectedBuildingID !== null) {
      this.#vectorGridLayer?.resetFeatureStyle(this.#selectedBuildingID);
      console.log(`Building with ID ${this.#selectedBuildingID} deselected`);
    }
    this.#selectedBuildingID = null;
    this.selectedBuilding = 0;
  }

  #addSearchMarker(latlng: L.LatLng): void {
    if (this.#markerLayer) {
      this.#map.removeLayer(this.#markerLayer);
    }
  
    this.#markerLayer = L.marker(latlng, {
    }).addTo(this.#map);
  }

  #selectBuildingFromLatLng(latLngCenter: L.LatLng): void {
    const { lat, lng } = latLngCenter;
    const srid = 4326;

    const point = `${lng},${lat},${srid}`; 
    
    const url = `http://128.131.21.198:3002/v1/intersect_point/${this.#tableName}/${point}}?columns=${this.#defaultColumns}`;

    fetch(url)
      .then((response) => {
        // Check if response is OK (status 200)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
      })
      .then((data: any) => {

        if (Array.isArray(data) && data.length > 0) {
          const buildingData = data[0];
           // Ensure that the data contains valid geometry and building ID
           if (buildingData && buildingData.geometry && buildingData.bw_geb_id) {
            try {
              const geometry = JSON.parse(buildingData.geometry);
              const buildingId = parseInt(buildingData.bw_geb_id);

              if (geometry && buildingId) {
                console.log('Selected (via search) Building ID:', buildingId);
                this.#highlightBuilding(geometry, buildingId);
              }
            } catch (parseError) {
              console.error('Error parsing geometry:', parseError);
            }
          } else {
            console.error('Invalid building data:', buildingData);
          }
        } else {
          console.warn('No building found at the given location');
        }
      })
      .catch((error) => {
        // Handle errors such as network issues, invalid JSON, etc.
        console.error('Error:', error);
      });
  }

  
  toggleFilterPanel(): void {
    const filterButton = document.querySelector('.leaflet-control-filter') as HTMLElement;
    if (filterButton) {
      L.DomEvent.disableClickPropagation(filterButton); // Disable click propagation
    }

    // Show a filter panel or if closed the button

    this.isFilterPanelVisible = !this.isFilterPanelVisible;
    console.log(`Filter menu visibility toggled: ${this.isFilterPanelVisible ? 'Visible' : 'Hidden'}`);
  }
  
}
