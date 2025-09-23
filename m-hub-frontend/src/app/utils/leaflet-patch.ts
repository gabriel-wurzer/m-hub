import * as L from 'leaflet';
import { environment } from '../../environments/environment';

// patch Leaflet bug: prevent "_targets of undefined" crash
(() => {
  const layerProto: any = (L as any).Layer.prototype;
  if (!layerProto.__patchedAddInteractiveTarget) {
    const orig = layerProto.addInteractiveTarget;
    let loggedOnce = false;
    layerProto.addInteractiveTarget = function (obj: any) {
      try {
        if (!this._targets) {
          this._targets = {}; // safeguard
        }
        return orig.call(this, obj);
      } catch (err) {
        if (!environment.production && !loggedOnce) {
          console.warn('Suppressed Leaflet addInteractiveTarget race condition on removed layer:', err);
          loggedOnce = true;
        }
        return this;
      }
    };
    layerProto.__patchedAddInteractiveTarget = true;
  }
})();
