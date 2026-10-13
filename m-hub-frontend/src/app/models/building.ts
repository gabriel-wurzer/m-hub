import { BuildingComponent } from "./building-component";
import { Document } from "./document";
import { Floor } from "./floor";

export interface Building extends BaseBuilding {
  userBuilding?: UserBuilding; // optional user-specific data
}

/**
 * Shared fields from buildings table
 */
export interface BaseBuilding {
    fid: number;
    bw_geb_id: string;
    dom_nutzung: number;
    bp_best_guess: number;
    bp: string;
    m3vol: number;
    m2bgf: number;
    m2bgf_use1: number;
    m2bgf_use2: number;
    m2bgf_use3: number;
    m2bgf_use4: number;
    m2flaeche: number;
    maxhoehe: number;
    bmg1: number;
    bmg2: number;
    bmg3: number;
    bmg4: number;
    bmg5: number;
    bmg6: number;
    bmg7: number;
    bmg8: number;
    bmg9: number;
    // share of the material group in the whole building in % (0-100), null if no material data
    bmg1_share: number | null;
    bmg2_share: number | null;
    bmg3_share: number | null;
    bmg4_share: number | null;
    bmg5_share: number | null;
    bmg6_share: number | null;
    bmg7_share: number | null;
    bmg8_share: number | null;
    bmg9_share: number | null;
    geometry: any; // Geometry as GeoJSON object
}

/**
 * User-specific fields from user-buildings table
 */
export interface UserBuilding {
  id: string;               // user_buildings.id
  user_id: string;          // reference to user
  building_id: string;      // reference to building
  structure: Floor[];
  name: string;
  address: string;
  documents?: Document[];                       // fetched via relation
  building_components?: BuildingComponent[];    // fetched via relation
}


