import { BuildingComponent } from "./building-component";
import { Document } from "./document";
import { Floor } from "./floor";


/**
 * Interface of buildings.
 */
export interface Building {
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

    // user-specific fields:  n : 1 relation  build --> user
    buildingComponents?: BuildingComponent[];  // Optional list of building parts
    documents?: Document[]; // Optional list of appended documents
    structure?: Floor[]; // Array of floors, each with type [Unter, Ueber, Dach], count and height in cm 
    // structure?: number[]; // Array of numbers representing the structure of the building -> [Unter, Ueber, Dach]    // OLD: [KG, EG, OG, DG]
    name?: string; // user specific name of the building
    address?: string; // user specific address of the building
}