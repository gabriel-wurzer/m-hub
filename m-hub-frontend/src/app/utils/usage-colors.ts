import { Usage, UsageLabels } from '../enums/usage.enum';

/**
 * Fixed colour per usage. A usage keeps its colour in every chart,
 * no matter which other usages are present in the data.
 */
export const USAGE_COLORS: Record<Usage, string> = {
  [Usage.WOHNEN]: '#34558b',
  [Usage.GEMISCHT]: '#e8a33d',
  [Usage.INDUSTRIE]: '#d1495b',
  [Usage.SONSTIGES]: '#8f9aa3',
};

/**
 * One usage as an ECharts pie entry with its fixed colour.
 * @param usage The usage category.
 * @param value Gross floor area of that usage.
 */
export function usagePieEntry(usage: Usage, value: number) {
  return { value, name: UsageLabels[usage], itemStyle: { color: USAGE_COLORS[usage] } };
}
