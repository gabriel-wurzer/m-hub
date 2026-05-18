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
  private highlightedFeatureLayer: L.GeoJSON | null = null;
  private buildingsLayer: L.Layer | null = null;
  private readonly buildingsTable = 'buildings_details';
  private readonly geometryColumns = ['fid', 'bw_geb_id', 'ST_AsGeoJSON(geom) as geometry'];

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
      this.highlightedFeatureLayer?.remove();
      this.buildingsLayer?.remove();
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
      minZoom: 12,
      maxZoom: 22,
      zoomControl: true,
      attributionControl: false
    }).setView([48.2082, 16.3738], 16);

    L.tileLayer(`https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${environment.mapboxToken}`, {
      minZoom: 12,
      maxZoom: 22,
      id: 'simlabtuwien/cm3r2nlew003y01s6g5gtfwtd'
    }).addTo(this.map);

    this.buildingsLayer = vectorTileLayer(
      this.mapService.getVectorTileUrl(this.buildingsTable, this.geometryColumns),
      {
        minZoom: 12,
        maxZoom: 22,
        style: { color: '#3388ff', weight: 1, fill: true, fillOpacity: 0.18 },
        interactive: false
      }
    ).addTo(this.map);

    setTimeout(() => this.map?.invalidateSize(), 50);
  }

  private loadSelectedBuilding(): void {
    if (!this.map || !this.buildingId) {
      this.loadError = this.buildingId ? null : 'Kein Gebaeude hinterlegt.';
      return;
    }

    this.loadError = null;

    this.mapService.getBuildingById(this.buildingsTable, this.buildingId, this.geometryColumns).subscribe({
      next: building => {
        if (!building?.geometry) {
          this.loadError = 'Gebaeude konnte nicht angezeigt werden.';
          return;
        }

        this.highlightBuilding(building.geometry);
      },
      error: error => {
        console.error('Failed to load listing building preview:', error);
        this.loadError = 'Gebaeude konnte nicht geladen werden.';
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
      this.loadError = 'Gebaeude konnte nicht angezeigt werden.';
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
    this.map.fitBounds(layer.getBounds(), { maxZoom: 18, padding: [16, 16] });
  }
}
