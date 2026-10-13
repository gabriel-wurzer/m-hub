import { MdabMaterialGroup } from '../enums/mdab-material-group.enum';

/**
 * Fixed colour per material group. A group keeps its colour in every chart,
 * no matter which other groups are present in the data.
 */
export const MATERIAL_GROUP_COLORS: Record<MdabMaterialGroup, string> = {
  [MdabMaterialGroup.mg_1]: '#5470c6',
  [MdabMaterialGroup.mg_2]: '#91cc75',
  [MdabMaterialGroup.mg_3]: '#fac858',
  [MdabMaterialGroup.mg_4]: '#ee6666',
  [MdabMaterialGroup.mg_5]: '#73c0de',
  [MdabMaterialGroup.mg_6]: '#3ba272',
  [MdabMaterialGroup.mg_7]: '#fc8452',
  [MdabMaterialGroup.mg_8]: '#9a60b4',
  [MdabMaterialGroup.mg_9]: '#ea7ccc',
};

/**
 * Order of the slices around a pie. Chosen so that neighbouring colours stay
 * distinguishable, also for colour-blind readers. The legend keeps the group order.
 */
const MATERIAL_GROUP_SLICE_ORDER: string[] = [
  MdabMaterialGroup.mg_1,
  MdabMaterialGroup.mg_2,
  MdabMaterialGroup.mg_8,
  MdabMaterialGroup.mg_7,
  MdabMaterialGroup.mg_9,
  MdabMaterialGroup.mg_3,
  MdabMaterialGroup.mg_4,
  MdabMaterialGroup.mg_5,
  MdabMaterialGroup.mg_6,
];

/** Colour of a material group by its number (1-9, as in bmg1..bmg9). */
export function materialGroupColor(group: number): string {
  return MATERIAL_GROUP_COLORS[MdabMaterialGroup[`mg_${group}` as keyof typeof MdabMaterialGroup]];
}

/**
 * Prepares material group entries for an ECharts pie: drops empty groups, sorts the
 * slices into MATERIAL_GROUP_SLICE_ORDER and pins each group's colour.
 * @param entries Material groups named by their MdabMaterialGroup label, in group order.
 * @returns The series data and the legend names (in group order).
 */
export function materialPieData(entries: { name: string, value: number }[]) {
  const present = entries.filter(entry => entry.value > 0);
  const slicePosition = (name: string) => {
    const index = MATERIAL_GROUP_SLICE_ORDER.indexOf(name);
    return index < 0 ? MATERIAL_GROUP_SLICE_ORDER.length : index;
  };

  return {
    data: [...present]
      .sort((a, b) => slicePosition(a.name) - slicePosition(b.name))
      .map(entry => ({
        ...entry,
        itemStyle: { color: MATERIAL_GROUP_COLORS[entry.name as MdabMaterialGroup] },
      })),
    legend: present.map(entry => entry.name),
  };
}
