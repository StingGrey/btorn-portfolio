export const variantList = [
  { id: 'itabag', name: '痛包' },
  { id: 'galge', name: '视觉小说' },
  { id: 'riso', name: '孔版印刷' },
  { id: 'glass', name: '毛玻璃' },
] as const;

export type VariantId = (typeof variantList)[number]['id'];

export function isVariantId(value: unknown): value is VariantId {
  return variantList.some((item) => item.id === value);
}
