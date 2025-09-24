import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { distinctUntilChanged, takeUntil } from 'rxjs/operators';
import * as L from 'leaflet';
import vectorTileLayer from 'leaflet-vector-tile-layer';
import 'leaflet-control-geocoder';

import { Building } from '../../models/building';
import { environment } from '../../../environments/environment';
import { FilterMenuComponent } from "../filter-menu/filter-menu.component";
import { FilterButtonComponent } from "../buttons/filter-button/filter-button.component";
import { FilterService } from '../../services/filter/filter.service';
import { BuildingSidepanelComponent } from '../building-sidepanel/building-sidepanel.component';
import { StructureViewComponent } from "../structure-view/structure-view.component";
import { MapService } from '../../services/map/map.service';
import { Subject } from 'rxjs';


L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl: 'assets/leaflet/marker-icon.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
});

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FilterMenuComponent, FilterButtonComponent, BuildingSidepanelComponent, StructureViewComponent],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit, OnDestroy, AfterViewInit {

  private readonly destroy$ = new Subject<void>();

  #zoomHandler?: () => void;
  #mapClickHandler?: () => void;

  #map!: L.Map;

  #highlightedFeatureLayer: L.GeoJSON | null = null;
  #markerLayer: L.Marker | null = null;

  #buildingsLayer: L.Layer | null = null;
  #buildingBlocksLayer: L.Layer | null = null;

  #selectedBuildingID: string | null = null;
  selectedBuilding!: Building | null;

  #buildingsTable = 'buildings_details'; // #buildingsTable = 'buildings_details_dev';
  #defaultColumns = ['bw_geb_id', 'ST_AsGeoJSON(geom) as geometry'];
  #additionalColumns = ['dom_nutzung', 'bp', 'm3vol', 'm2bgf', 'm2bgf_use1', 'm2bgf_use2', 'm2bgf_use3', 'm2bgf_use4', 'm2flaeche', 'maxhoehe', 'bmg1', 'bmg2', 'bmg3', 'bmg4', 'bmg5', 'bmg6', 'bmg7', 'bmg8', 'bmg9'];    

  #buildingBlockTable = 'baubloecke_vienna';
  #defaultColumnsBB = ['blk', 'ST_AsGeoJSON(geom) as geometry'];

  isFilterPanelVisible = false;
  isStructureViewVisible = false;

  constructor(
    private filterService: FilterService,
    private mapService: MapService
  ) {}

  ngOnInit(): void {

    this.#initMap();
    this.#initGeocoder();

    this.filterService.filters$
      .pipe(
        distinctUntilChanged((a, b) =>
          JSON.stringify(a.usages) === JSON.stringify(b.usages) &&
          JSON.stringify(a.periods) === JSON.stringify(b.periods)
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(({ usages, periods }) => {
        this.applyFilter(usages, periods);
      });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.#map.invalidateSize(), 50);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.#zoomHandler) this.#map.off('zoomend', this.#zoomHandler);
    if (this.#mapClickHandler) this.#map.off('click', this.#mapClickHandler);

    // remove leaflet controls, map layers and the map instance
    try {
      this.deselectBuilding();
      if (this.#markerLayer) {
        this.#map.removeLayer(this.#markerLayer);
        this.#markerLayer = null;
      }
      if (this.#buildingsLayer && this.#map.hasLayer(this.#buildingsLayer)) {
        this.#map.removeLayer(this.#buildingsLayer);
      }
      if (this.#buildingBlocksLayer && this.#map.hasLayer(this.#buildingBlocksLayer)) {
        this.#map.removeLayer(this.#buildingBlocksLayer);
      }
      this.#map.off();
      this.#map.remove();
    } catch (err) {
      console.warn('Error during map destroy:', err);
    }
  }

  /**
   * Initialize the map and set up base layers.
   * Bounds and view set for Vienna.
   * Use Mapbox baselayer
   */
  #initMap(): void {
    
    // tolerant patch for addInteractiveTarget (safety net)
    (() => {
      const mapProto: any = (L as any).Map.prototype;
      if (!mapProto.__patchedAddInteractiveTarget) {
        const orig = mapProto.addInteractiveTarget;
        mapProto.addInteractiveTarget = function (obj: any) {
          try {
            if (!this || typeof this !== 'object') return this;
            if (!this._targets) this._targets = {};
            return orig.call(this, obj);
          } catch (err) {
            console.warn('Ignored addInteractiveTarget error (patched):', err);
            return this;
          }
        };
        mapProto.__patchedAddInteractiveTarget = true;
      }
    })();

    this.#map = L.map('map', {
      minZoom: 12,
      maxZoom: 22,
      zoomControl: false,
    })
    .setView([48.2082, 16.3738], 12); // Vienna coordinates

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

    // preload both layers but don’t add yet
    this.#buildingsLayer = this.#createBuildingsLayer();
    this.#buildingBlocksLayer = this.#createBuildingBlocksLayer();

    // run once at start
    this.#updateVisibleLayer();

    // handle zoom switching
    this.#zoomHandler = L.Util.throttle(
      () => this.#updateVisibleLayer(),
      100,
      this
    );
    this.#map.on("zoomend", this.#zoomHandler);

    // handle map clicks
    this.#mapClickHandler = () => {
      if (this.#markerLayer) {
        this.#map.removeLayer(this.#markerLayer);
        this.#markerLayer = null;
      }
      if (this.selectedBuilding !== null) {
        this.deselectBuilding();
      }
    };
    this.#map.on("click", this.#mapClickHandler);
  }

  /**
   * Initialize and configure the Leaflet geocoder control on the map.
   * - Customizes geocode method to use the mapService.searchAddress() for Nominatim queries.
   * - Handles geocoding results, zooming, marker placement, and building lookup.
   */
  #initGeocoder(): void {
    L.Icon.Default.prototype.options.shadowUrl = '';
    L.Icon.Default.prototype.options.shadowSize = [0, 0];

    const geocoderControl = L.Control.geocoder({
      defaultMarkGeocode: false,
      position: 'topleft',
      placeholder: 'Suchen..'
    });

    geocoderControl.options.geocoder.geocode = (query: string, cb: any) => {
      this.mapService.searchAddress(query).subscribe({
        next: (results) => cb(results),
        error: (err) => {
          console.error('searchAddress error', err);
          cb([]);
        }
      });
    };

    geocoderControl.on('markgeocode', (e: any) => {
      console.log('Geocode response:', e.geocode);
      const center = e.geocode.center;
      const lat = center[0], lng = center[1];

      const zoomLevel = this.#map.getZoom() > 18 ? this.#map.getZoom() : 18;
      this.#map.setView(center, zoomLevel);

      this.#addSearchMarker(center);

      const queryColumns = [...this.#defaultColumns, ...this.#additionalColumns];
      
      this.mapService.getBuildingFromLatLng(lat, lng, queryColumns).subscribe({
        next: (building) => {
          if (building) {
            this.selectedBuilding = building;
            console.log("Selected Building:", this.selectedBuilding);
            this.#highlightBuilding();
          } else {
            this.deselectBuilding();
            console.warn('No building found at geocode location.');
          }
        },
        error: (err) => {
          console.error("Error fetching building:", err);
        }
      });
    });

    geocoderControl.addTo(this.#map);
  }

  /**
   * Add or update a search marker on the map at the given coordinates.
   * If a marker already exists, it will be replaced with the new one.
   * @param latlng Coordinates as [lat, lng] array or Leaflet LatLng object.
   */
  #addSearchMarker(latlng: L.LatLng): void {
    const point = Array.isArray(latlng) ? L.latLng(latlng[0], latlng[1]) : latlng;
    if (this.#markerLayer) {
      this.#map.removeLayer(this.#markerLayer);
    }
    this.#markerLayer = L.marker(point as L.LatLng).addTo(this.#map);
  }

  /**
   * Update the visible map layer based on the current zoom level.
   * - Shows building polygons when zoomed in (>= 16).
   * - Shows building block polygons when zoomed out (< 16).
   * - Ensures only one of the two layers is active at a time.
   */
  #updateVisibleLayer(): void {
      if (!this.#map) return;
      const zoomThreshold = 16;
      const zoom = this.#map.getZoom();

    if (zoom >= zoomThreshold) { // show buildings, remove blocks
      if (this.#buildingBlocksLayer && this.#map.hasLayer(this.#buildingBlocksLayer)) {
        this.#map.removeLayer(this.#buildingBlocksLayer);
      }
      if (this.#buildingsLayer && !this.#map.hasLayer(this.#buildingsLayer)) {
        this.#map.addLayer(this.#buildingsLayer);
      }
    } else {          // show blocks, remove buildings
      if (this.#buildingsLayer && this.#map.hasLayer(this.#buildingsLayer)) {
        this.#map.removeLayer(this.#buildingsLayer);
      }
      if (this.#buildingBlocksLayer && !this.#map.hasLayer(this.#buildingBlocksLayer)) {
        this.#map.addLayer(this.#buildingBlocksLayer);
      }
    }
  }

  /**
   * Create and configure a Leaflet vector tile layer for buildings.
   * - Fetches vector tiles from the PostGIS API.
   * - Applies style rules for building display.
   * - Enables interactivity and attaches a click handler for building selection.
   * @param filter Optional SQL WHERE clause string for filtering buildings.
   * @returns Leaflet Vector Tile Layer configured with buildings data.
   */
  #createBuildingsLayer(filter?: string): L.Layer {
    const url = this.mapService.getVectorTileUrl(this.#buildingsTable, this.#defaultColumns, filter);

    return vectorTileLayer(url, {
      minZoom: 16, // safeguard
      maxZoom: 22,
      style: { color: '#3388ff', weight: 1, fill: true, fillOpacity: 0.3 },
      interactive: true,
    }).on('click', (event: any) => {
      this.#handleBuildingClick(event.layer.properties['bw_geb_id']);
    });
  }

  /**
   * Create and configure a Leaflet vector tile layer for building blocks.
   * - Fetches vector tiles from the PostGIS API.
   * - Applies style rules for building block display.
   * - Enables interactivity and attaches a click handler for building block selection.
   * @returns Leaflet Vector Tile Layer configured with building block data.
   */
  #createBuildingBlocksLayer(): L.Layer {
    const url = this.mapService.getVectorTileUrl(this.#buildingBlockTable, this.#defaultColumnsBB);

    return vectorTileLayer(url, {
      minZoom: 12,
      maxZoom: 15, // safeguard
      style: { color: '#446696ff', weight: 1, fill: true, fillOpacity: 0.2 },
      interactive: true,
    }).on('click', (event: any) => {
      this.#handleBuildingBlockClick(event);
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

    if (this.#buildingsLayer) this.#map.removeLayer(this.#buildingsLayer);
    this.#buildingsLayer = this.#createBuildingsLayer(filterQuery);
    this.#updateVisibleLayer();   
  }

  /**
   * Handles a click event on a building block feature in the VectorGrid layer.
   * Zooms into the selected building block.
   * @param event Click event containing building block feature properties.
   */
  #handleBuildingBlockClick(event: any): void {
    const properties = event.layer.properties;
  
    if (properties) {
      const buildingBlockId = properties['blk'];
      console.log('Clicked Building Block ID:', buildingBlockId);

      const geometry = properties['geometry']; // already requested in #defaultColumnsBB
      if (!geometry) {
        console.warn('No geometry found for building block:', buildingBlockId);
        return;
      }
      
      try {
        const geometryObj = JSON.parse(geometry);
        const blockLayer = L.geoJSON(geometryObj);
        const bounds = blockLayer.getBounds();

        this.#map.fitBounds(bounds, { maxZoom: 17 });

        // highlight the block temporarily for selecton feedback
        blockLayer.setStyle({
          weight: 2,
          fillOpacity: 0.2,
        }).addTo(this.#map);

        // remove highlight after a short delay
        setTimeout(() => {
          this.#map.removeLayer(blockLayer);
        }, 500);

      } catch (err) {
        console.error('Failed to parse building block geometry:', err);
      }
    }
  }


  /**
   * Handles a click event on a building feature in the buildings Vector tile layer.
   * Fetches detailed building data from the API and highlights the selected building.
   * @param buildingId Id of the selected building feature via click event.
   */
  #handleBuildingClick(buildingId: string): void {
    const queryColumns = [...this.#defaultColumns, ...this.#additionalColumns];

    this.mapService.getBuildingById(this.#buildingsTable, buildingId, queryColumns).subscribe({
      next: building => {
        this.selectedBuilding = building;
        this.#highlightBuilding();
      },
      error: err => console.error("Error fetching building:", err)
    });
  }

  /**
   * Highlight the currently selected building on the map.
   * - Parses the building geometry from WKT/GeoJSON.
   * - Draws a red polygon layer to visually highlight the building.
   * - Fits the map view to the building’s bounds with a minimum zoom level.
   */
  #highlightBuilding(): void {
    if (this.selectedBuilding && this.selectedBuilding.geometry) {
      try {
        const geometryObj = JSON.parse(this.selectedBuilding.geometry);

        if (this.#highlightedFeatureLayer) {
          this.#map.removeLayer(this.#highlightedFeatureLayer);
          this.#highlightedFeatureLayer = null;
        }
    
        const layer = L.geoJSON(geometryObj, {
          style: {
            color: '#ff0000',
            weight: 3,
            fill: true,
            fillColor: '#ff0000',
            fillOpacity: 0.5,
          },
        });

        this.#highlightedFeatureLayer = layer.addTo(this.#map);
        this.#selectedBuildingID = this.selectedBuilding.bw_geb_id;
        
        const bounds = layer.getBounds();
        const targetZoom = Math.max(this.#map.getZoom(), 18);
        this.#map.fitBounds(bounds, { maxZoom: targetZoom });
        console.log(`Building with ID ${this.#selectedBuildingID} selected and highlighted.`);
      } catch (geometryParseError) {
        console.error("Error parsing geometry data:", geometryParseError);
      }
    } else {
      console.error("No geometry data found in building object:", this.selectedBuilding);
    }
  }

  /**
   * Deselect the currently highlighted building on the map.
   * - Removes the highlight polygon layer if present.
   * - Clears the selected building ID and building reference.
   */
  deselectBuilding(): void {
    if (this.#highlightedFeatureLayer) {
      this.#map.removeLayer(this.#highlightedFeatureLayer); // Remove highlight layer
      this.#highlightedFeatureLayer = null;
    }
    if (this.#selectedBuildingID !== null) {
      console.log(`Building with ID ${this.#selectedBuildingID} deselected`);
    }
    this.#selectedBuildingID = null;
    this.selectedBuilding = null;
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
    }
  }

  enableMapInteractions() {
    if (this.#map) {
      this.#map.dragging.enable();
      this.#map.scrollWheelZoom.enable();
      this.#map.tapHold?.enable();
    }
  }

  showStructureView(): void {
    this.isStructureViewVisible = true;
  }
  
  hideStructureView(): void {
    this.isStructureViewVisible = false;
  }
}