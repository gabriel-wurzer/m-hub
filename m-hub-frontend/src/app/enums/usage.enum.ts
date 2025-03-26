/**
 * Enum for building usages.
 */
export enum Usage {
  WOHNEN = 1,
  GEMISCHT = 2,
  INDUSTRIE = 3,
  SONSTIGES = 4
}

export const UsageLabels: Record<number, string> = {
  [Usage.WOHNEN]: 'Wohnen',
  [Usage.GEMISCHT]: 'Gemischt/Büro',
  [Usage.INDUSTRIE]: 'Industrie',
  [Usage.SONSTIGES]: 'Sonstiges'
};