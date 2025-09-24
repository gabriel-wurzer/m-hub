import { BuildingComponent } from "./building-component";
import { Document } from "./document";
import { Floor } from "./floor";


/**
 * Shared fields from buildings table
 */
export interface BaseBuilding {
    bw_geb_id: string;
    dom_nutzung: number;
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
    geometry: any; // Geometry as GeoJSON object
}

/**
 * User-specific fields from user-buildings table
 */
export interface UserBuilding {
  id: string;              // user_buildings.id
  userId: string;          // reference to user
  buildingId: string;      // reference to building
  structure: Floor[];
  name?: string;           
  address?: string;        
  documents?: Document[];
  buildingComponents?: BuildingComponent[];
}


export interface Building extends BaseBuilding {
  userBuilding?: UserBuilding; // optional user-specific data
}

// // Uniform entity
// export interface Building {
//   baseBuilding: BaseBuilding;
//   userBuilding?: UserBuilding; // optional: may not exist if current user hasn’t added it yet
// }