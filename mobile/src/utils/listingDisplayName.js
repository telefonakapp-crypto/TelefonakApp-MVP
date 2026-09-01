/**
 * Build a human-readable listing title from separate brand/model names.
 * Presentation-only — does not modify stored catalog or API values.
 */
export function getListingDisplayName(brandName, modelName) {
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

function normalizePart(value) {
  if (value == null || value === '') return '';
  return String(value).trim();
}
