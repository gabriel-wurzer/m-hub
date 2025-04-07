import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet.vectorgrid';
import 'leaflet-control-geocoder';


import { Building } from '../../models/building';
import { environment } from '../../../environments/environment';
import { FilterMenuComponent } from "../filter-menu/filter-menu.component";
import { FilterButtonComponent } from "../buttons/filter-button/filter-button.component";
import { FilterService } from '../../services/filter/filter.service';
import { BuildingSidepanelComponent } from '../building-sidepanel/building-sidepanel.component';
import { StructureDetailsComponent } from '../structure-details/structure-details.component';


@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FilterMenuComponent, FilterButtonComponent, BuildingSidepanelComponent, StructureDetailsComponent],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit {

  #map!: L.Map;
  #vectorGridLayer: L.VectorGrid.Protobuf | null = null;
  #highlightedFeatureLayer: L.GeoJSON | null = null;
  #markerLayer: L.Marker | null = null;


  #selectedBuildingID: number | null = null;
  selectedBuilding!: Building | null;

  #buildingClicked = false;

  #tableName = 'buildings_details';
  #defaultColumns = ['bw_geb_id', 'ST_AsGeoJSON(geom) as geometry'];
  #additionalColumns = ['dom_nutzung', 'bp', 'm3vol', 'm2bgf', 'm2bgf_use1', 'm2bgf_use2', 'm2bgf_use3', 'm2bgf_use4', 'm2flaeche', 'maxhoehe', 'bmg1', 'bmg2', 'bmg3', 'bmg4', 'bmg5', 'bmg6', 'bmg7', 'bmg8', 'bmg9'];    
  // additionalColumns: string[] = [];  // Stores extra columns dynamically

  isFilterPanelVisible = false;
  isStructureDetailsVisible = false;

  constructor(private filterService: FilterService) {}

  ngOnInit(): void {
    this.#initMap();

    // Subscribe to filter changes and apply them
    this.filterService.usageFilter$.subscribe(selectedUsages => {
      this.applyFilter(selectedUsages, this.filterService.getPeriodFilter());
    });

    this.filterService.periodFilter$.subscribe(selectedPeriods => {
      this.applyFilter(this.filterService.getUsageFilter(), selectedPeriods);
    });
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

    L.tileLayer(`https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${environment.mapboxToken}`, {
      minZoom: 12,
      maxZoom: 22, // 19
      attribution: '© <a href="https://www.mapbox.com/">Mapbox</a>',
      id: "simlabtuwien/cm3r2nlew003y01s6g5gtfwtd"
    }).addTo(this.#map);


    this.#loadVectorGridLayer();
    this.#initGeocoder();

    this.#map.on('click', () => {

      if (this.#markerLayer) {
        this.#map.removeLayer(this.#markerLayer);
        this.#markerLayer = null;
      }

      if (!this.#buildingClicked) {
        this.deselectBuilding();
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
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}, Vienna&countrycodes=AT`;
      // const url = `/nominatim/search?format=json&limit=5&q=${encodeURIComponent(query)}, Vienna&countrycodes=AT`;

      console.log('Nominatim request URL:', url);

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
        const name = parts[0] || '';
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

  /**
   * Load the VectorGrid Layer with default styles and event listeners.
   * @param filter [optional] SQL WHERE clause for filtering data (column dom_nutzung AND/OR bp).
   */
  #loadVectorGridLayer(filter?:string): void {
    if (!this.#map) return;
    
    if (this.#vectorGridLayer) {
      this.#map.removeLayer(this.#vectorGridLayer);
    }

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
      getFeatureId: (feature: any) => ((feature.properties as Building).bw_geb_id).toString() // set building_id as unique feature identifier; vector grid expects a string ID
    });

    
    this.#vectorGridLayer.addTo(this.#map);

    this.#vectorGridLayer.on('click', (event: any) => {
      this.#buildingClicked = true;
      event.originalEvent.stopPropagation(); // Prevent map click handler
      this.#handleBuildingClick(event);
    });
  }

  /**
   * Applies filter to the dataset and reloads the VectorGrid layer.
   * @param selectedUsages Array of selected usage categories as number array.
   * @param selectedPeriods Array of selected building periods as number array.
   */
  applyFilter(selectedUsages: number[], selectedPeriods: number[]): void {
    let filter: string[] = [];

    // Filter for usage
    if (selectedUsages.length > 0) {
        filter.push(`dom_nutzung IN (${selectedUsages.join(', ')})`);
    }

    // Filter for building periods
    if (selectedPeriods.length > 0) {
      const periodFilter = selectedPeriods.join(', ');
      filter.push(`
          EXISTS (
              SELECT 1 FROM regexp_split_to_table(bp, ',') AS bp_value
              WHERE bp_value::int IN (${periodFilter})
          )
      `);
    }

    let filterQuery = filter.length > 0 ? filter.join(' AND ') : undefined;

    this.#loadVectorGridLayer(filterQuery);
  }

  /**
   * Handles a click event on a building feature in the VectorGrid layer.
   * Fetches detailed building data from the API and highlights the selected building.
   * @param event Click event containing building feature properties.
   */
  #handleBuildingClick(event: any): void {
    const properties = event.layer.properties;
  
    if (properties) {
      const buildingId = parseInt(properties['bw_geb_id']);
      console.log('Clicked Building ID:', buildingId);
      
      const queryColumns = [...this.#defaultColumns, ...this.#additionalColumns];

      const url = `http://128.131.21.198:3002/v1/query/${this.#tableName}?columns=${encodeURIComponent(queryColumns.join(','))}&filter=${encodeURIComponent(`bw_geb_id = ${buildingId}`)}`;

      fetch(url)
        .then(response => response.text())
        .then(rawData => {
          try {
            const data = JSON.parse(rawData);
            const building = Array.isArray(data) ? data[0] : data;
            
            this.selectedBuilding = building;
            console.log("Selected Building:", this.selectedBuilding);
  
            this.#highlightBuilding();
          } catch (parseError) {
            console.error("Error parsing JSON response:", parseError, "Raw data:", rawData);
          }
        })
        .catch(error => console.error("Error fetching building data:", error));
  
      this.#buildingClicked = true;
    }
  }
  

  #highlightBuilding(): void {
    if (this.selectedBuilding && this.selectedBuilding.geometry) {
      try {
        const geometryObj = JSON.parse(this.selectedBuilding.geometry);

        if (this.#highlightedFeatureLayer) {
          this.#map.removeLayer(this.#highlightedFeatureLayer);
          this.#highlightedFeatureLayer = null;
        }
    
        this.#highlightedFeatureLayer = L.geoJSON(geometryObj, {
          style: {
            color: '#ff0000',
            weight: 3,
            fill: true,
            fillColor: '#ff0000',
            fillOpacity: 0.5,
          },
        }).addTo(this.#map);
    
        this.#selectedBuildingID = this.selectedBuilding.bw_geb_id;
    
        const bounds = L.geoJSON(geometryObj).getBounds();
        const currentZoom = this.#map.getZoom();
        const targetZoom = Math.max(currentZoom, 18);
        this.#map.fitBounds(bounds, { maxZoom: targetZoom });

      } catch (geometryParseError) {
        console.error("Error parsing geometry data:", geometryParseError);
      }
    } else {
      console.error("No geometry data found in building object:", this.selectedBuilding);
    }
  }

  deselectBuilding(): void {
    if (this.#highlightedFeatureLayer) {
      this.#map.removeLayer(this.#highlightedFeatureLayer); // Remove highlight layer
      this.#highlightedFeatureLayer = null;
    }
    if (this.#selectedBuildingID !== null) {
      this.#vectorGridLayer?.resetFeatureStyle(this.#selectedBuildingID);
      console.log(`Building with ID ${this.#selectedBuildingID} deselected`);
    }
    this.#selectedBuildingID = null;
    this.selectedBuilding = null;
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

    const queryColumns = [...this.#defaultColumns, ...this.#additionalColumns];
    
    const url = `http://128.131.21.198:3002/v1/intersect_point/${this.#tableName}/${point}}?columns=${queryColumns}`;

    fetch(url)
        .then(response => response.text())
        .then(rawData => {
          try {
            const data = JSON.parse(rawData);
            const building = Array.isArray(data) ? data[0] : data;
            
            this.selectedBuilding = building;
            console.log("Selected Building:", this.selectedBuilding);
  
            this.#highlightBuilding();
          } catch (parseError) {
            console.error("Error parsing JSON response:", parseError, "Raw data:", rawData);
          }
        })
        .catch(error => console.error("Error fetching building data:", error));
  }

  
  toggleFilterPanel(): void {
    const filterButton = document.querySelector('.leaflet-control-filter') as HTMLElement;
    if (filterButton) {
      L.DomEvent.disableClickPropagation(filterButton);
    }

    this.isFilterPanelVisible = !this.isFilterPanelVisible;
    console.log(`Filter menu visibility toggled: ${this.isFilterPanelVisible ? 'Visible' : 'Hidden'}`);

    if (!this.isFilterPanelVisible) {
      this.enableMapInteractions();
    }
  }

  disableMapInteractions() {
    if (this.#map) {
      this.#map.dragging.disable();
      this.#map.scrollWheelZoom.disable();
      this.#map.tapHold?.disable();
      // console.log('map interaction disabled');
    }
  }

  enableMapInteractions() {
    if (this.#map) {
      this.#map.dragging.enable();
      this.#map.scrollWheelZoom.enable();
      this.#map.tapHold?.enable();
      // console.log('map interaction enabled');
    }
  }

  // // When the side panel emits openStructureView, show the structure details and hide other elements
  // showStructureDetails(building: Building) {
  //   this.selectedBuilding = building;
  //   this.isStructureDetailsVisible = true;
  // }

  // // When closing structure details, show the map and side panel again
  // hideStructureDetails() {
  //   this.isStructureDetailsVisible = false;
  // }
  
  showStructureDetails(event: any): void {
    this.isStructureDetailsVisible = true;

    // console.log(this.isStructureDetailsVisible);
  }
  
  hideStructureDetails(): void {
    this.isStructureDetailsVisible = false;

    // console.log(this.isStructureDetailsVisible);
  }

}
