import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import vectorTileLayer from 'leaflet-vector-tile-layer';

import { environment } from '../../../environments/environment';
import { MapService } from '../../services/map/map.service';

@Component({
  selector: 'app-market-listing-map-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './market-listing-map-preview.component.html',
  styleUrl: './market-listing-map-preview.component.scss'
})
export class MarketListingMapPreviewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() buildingId: string | null | undefined = null;

  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLElement>;

  loadError: string | null = null;

  private map?: L.Map;
  private zoomHandler?: () => void;
  private highlightedFeatureLayer: L.GeoJSON | null = null;
  private buildingsLayer: L.Layer | null = null;
  private buildingBlocksLayer: L.Layer | null = null;
  private readonly buildingsTable = 'buildings_details';
  private readonly geometryColumns = ['fid', 'bw_geb_id', 'ST_AsGeoJSON(geom) as geometry'];
  private readonly buildingBlocksTable = 'buildingblocks';
  private readonly buildingBlockColumns = ['blk', 'ST_AsGeoJSON(geom) as geometry'];
  private readonly buildingZoomThreshold = 15;
  private readonly previewMaxZoom = 17;

  constructor(private mapService: MapService) {}

  ngAfterViewInit(): void {
    this.initMap();
    this.loadSelectedBuilding();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['buildingId'] && this.map) {
      this.loadSelectedBuilding();
    }
  }

  ngOnDestroy(): void {
    try {
      if (this.zoomHandler) this.map?.off('zoomend', this.zoomHandler);
      this.highlightedFeatureLayer?.remove();
      this.buildingsLayer?.remove();
      this.buildingBlocksLayer?.remove();
      this.map?.off();
      this.map?.remove();
    } catch (error) {
      console.warn('Error destroying market listing map preview:', error);
    }
  }

  private initMap(): void {
    const container = this.mapContainer?.nativeElement;
    if (!container || this.map) return;

    this.map = L.map(container, {
      minZoom: 11,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: false
    }).setView([48.2082, 16.3738], 16);

    L.tileLayer(`https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${environment.mapboxToken}`, {
      minZoom: 11,
      maxZoom: 19,
      id: 'simlabtuwien/cm3r2nlew003y01s6g5gtfwtd'
    }).addTo(this.map);

    this.buildingsLayer = this.createBuildingsLayer();
    this.buildingBlocksLayer = this.createBuildingBlocksLayer();
    this.updateVisibleLayer();

    this.zoomHandler = L.Util.throttle(
      () => this.updateVisibleLayer(),
      100,
      this
    );
    this.map.on('zoomend', this.zoomHandler);

    setTimeout(() => this.map?.invalidateSize(), 50);
  }

  private updateVisibleLayer(): void {
    if (!this.map) return;

    if (this.map.getZoom() >= this.buildingZoomThreshold) {
      if (this.buildingBlocksLayer && this.map.hasLayer(this.buildingBlocksLayer)) {
        this.map.removeLayer(this.buildingBlocksLayer);
      }
      if (this.buildingsLayer && !this.map.hasLayer(this.buildingsLayer)) {
        this.map.addLayer(this.buildingsLayer);
      }
      return;
    }

    if (this.buildingsLayer && this.map.hasLayer(this.buildingsLayer)) {
      this.map.removeLayer(this.buildingsLayer);
    }
    if (this.buildingBlocksLayer && !this.map.hasLayer(this.buildingBlocksLayer)) {
      this.map.addLayer(this.buildingBlocksLayer);
    }
  }

  private createBuildingsLayer(): L.Layer {
    return vectorTileLayer(
      this.mapService.getVectorTileUrl(this.buildingsTable, this.geometryColumns),
      {
        minZoom: this.buildingZoomThreshold,
        maxZoom: 22,
        style: { color: '#3388ff', weight: 1, fill: true, fillOpacity: 0.18 },
        interactive: false
      }
    );
  }

  private createBuildingBlocksLayer(): L.Layer {
    return vectorTileLayer(
      this.mapService.getVectorTileUrl(this.buildingBlocksTable, this.buildingBlockColumns),
      {
        minZoom: 11,
        maxZoom: this.buildingZoomThreshold - 1,
        style: { color: '#446696ff', weight: 1, fill: true, fillOpacity: 0.2 },
        interactive: false
      }
    );
  }

  private loadSelectedBuilding(): void {
    if (!this.map || !this.buildingId) {
      this.loadError = this.buildingId ? null : 'Kein Gebäude hinterlegt.';
      return;
    }

    this.loadError = null;

    this.mapService.getBuildingById(this.buildingsTable, this.buildingId, this.geometryColumns).subscribe({
      next: building => {
        if (!building?.geometry) {
          this.loadError = 'Gebäude konnte nicht angezeigt werden.';
          return;
        }

        this.highlightBuilding(building.geometry);
      },
      error: error => {
        console.error('Failed to load listing building preview:', error);
        this.loadError = 'Gebäude konnte nicht geladen werden.';
      }
    });
  }

  private highlightBuilding(geometry: string | object): void {
    if (!this.map) return;

    let geometryObj: any;

    try {
      geometryObj = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
    } catch (error) {
      console.error('Failed to parse listing building geometry:', error);
      this.loadError = 'Gebäude konnte nicht angezeigt werden.';
      return;
    }

    if (this.highlightedFeatureLayer) {
      this.map.removeLayer(this.highlightedFeatureLayer);
      this.highlightedFeatureLayer = null;
    }

    const layer = L.geoJSON(geometryObj, {
      style: {
        color: '#ff3b30',
        weight: 3,
        fill: true,
        fillColor: '#ff3b30',
        fillOpacity: 0.45
      }
    });

    this.highlightedFeatureLayer = layer.addTo(this.map);
    this.map.fitBounds(layer.getBounds(), { maxZoom: this.previewMaxZoom, padding: [16, 16] });
  }
}
