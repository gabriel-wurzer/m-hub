declare module 'leaflet-vector-tile-layer' {
  import * as L from 'leaflet';

  interface VectorTileLayerOptions extends L.LayerOptions {
    style?: any;
    minZoom?: number;
    maxZoom?: number;
    interactive?: boolean;
    pane?: string;
    attribution?: string;
  }

  export default function vectorTileLayer(
    url: string,
    options?: VectorTileLayerOptions
  ): L.Layer;
}