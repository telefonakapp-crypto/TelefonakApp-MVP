/**
 * MVP-visible device categories (must stay in sync with backend/config/mvpCategories.js).
 * Non-MVP categories remain in the API/DB architecture for future expansion.
 */
export const MVP_CATEGORY_SLUGS = Object.freeze(['phones', 'smartwatches']);

export function filterMvpCategories(categories = []) {
  return (categories || []).filter(
    (cat) => cat && MVP_CATEGORY_SLUGS.includes(cat.slug)
  );
}

export function localizedCategoryName(category, language) {
  if (!category) return '';
  if (language === 'ar' && category.name_ar) return category.name_ar;
  return category.name_en || category.name || category.slug || '';
}
