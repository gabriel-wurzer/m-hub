import * as L from 'leaflet';

declare module 'leaflet' {
  namespace Control {
    class Geocoder {
      static mapbox(accessToken: string, options?: any): any;
    }

    function geocoder(options?: any): any;
  }
}
