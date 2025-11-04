/**
 * Enum for supported types of 'Bauteil'.
 */
export enum PartType {
    Wand = 'Wand', // keine Unterscheidung zwischen Außen-, Innen- & Zwischenwand
    Boden = 'Boden',
    Dachaufbau = 'Dachaufbau', // wie Boden2 im Regelgeschoss Dach mit Typ Steildach (da hier auch normaler Boden vorhanden); wie Boden im Regelgeschoss Dach mit Typ Flachdach
    Kniestock = 'Kniestock', // wie Wand im Regelgeschoss Dach mit Typ Steildach
    Attika = 'Attika', // wie Wand im Regelgeschoss Dach mit Typ Flachdach
}
