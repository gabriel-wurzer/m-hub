import { FloorType } from "../enums/floor-type.enum";
import { RoofType } from "../enums/roof-type.enum";

/**
 * Base interface for all floors.
 */
interface BaseFloor {
  type: FloorType;
  description?: string;
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

/**
 * Eine Verortung in der Auswahl: ein Eintrag je Block der Gebaeudestruktur.
 */
export interface FloorOption {
  label: string;
  description?: string;
}

/**
 * Baut die Verortungs-Bezeichnungen aus der Gebaeudestruktur.
 *
 * Ein Eintrag je BLOCK, durchgehend je Typ nummeriert. Die `count` eines Blocks
 * wird bewusst NICHT aufgefaechert: sie sagt, wie viele gleichartige Geschosse
 * der Block umfasst, nicht wie viele Verortungen es gibt.
 *
 * Das ist die einzige Stelle, an der diese Bezeichnungen entstehen. Sie landen
 * als `location` an Bauteilen und Objekten und gehen beim Absprung als
 * `storeys` an das Plan-Werkzeug. Zaehlt eine zweite Stelle anders, bekommt
 * dasselbe Geschoss zwei Namen.
 */
export function buildFloorOptions(structure: Floor[]): FloorOption[] {
  const laufendeNummer: Record<string, number> = {
    [FloorType.KG]: 0,
    [FloorType.RG]: 0,
  };

  return structure.map((floor) => {
    const description =
      typeof floor.description === 'string' && floor.description.trim().length > 0
        ? floor.description.trim()
        : undefined;

    if (floor.type === FloorType.KG || floor.type === FloorType.RG) {
      laufendeNummer[floor.type] += 1;
      return { label: `${floor.type} ${laufendeNummer[floor.type]}`, description };
    }

    return { label: floor.type, description };
  });
}
