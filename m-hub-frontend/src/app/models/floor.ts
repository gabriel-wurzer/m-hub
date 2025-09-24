import { FloorType } from "../enums/floor-type.enum";
import { RoofType } from "../enums/roof-type.enum";

/**
 * Base interface for all floors.
 */
interface BaseFloor {
  type: FloorType;
  name?: string;
}

/**
 * Floors of type KG or RG.
 */
export interface StandardFloor extends BaseFloor {
  type: FloorType.KG | FloorType.RG;  // explicitly limited
  count: number;                      // number of floors of this type
  height: number;                     // height of standard floors of this type in cm
  area: number;                       // area of the floor in square meters
}

/**
 * Floors of type Dach (roof).
 */
export interface RoofFloor extends BaseFloor {
  type: FloorType.D;
  roofType: RoofType; // either Steildach or Flachdach
}

/**
 * Union of all floor types.
 */
export type Floor = StandardFloor | RoofFloor;
