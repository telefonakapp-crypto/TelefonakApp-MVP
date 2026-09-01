/**
 * Build a human-readable listing title from separate brand/model names.
 * Presentation-only — does not modify stored catalog or API values.
 */
export function getListingDisplayName(
  brandName: string | null | undefined,
  modelName: string | null | undefined,
): string {
  const brand = normalizePart(brandName);
  const model = normalizePart(modelName);

  if (!brand && !model) return '';
  if (!brand) return model;
  if (!model) return brand;

  if (model.toLowerCase().startsWith(brand.toLowerCase())) {
    return model;
  }

  return `${brand} ${model}`;
}

function normalizePart(value: string | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value).trim();
}
