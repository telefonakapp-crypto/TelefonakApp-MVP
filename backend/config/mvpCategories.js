/**
 * MVP-visible device categories.
 * Rows for other categories remain in the DB (is_active = false) for future expansion.
 * To launch a new category: set is_active = true in DB and add its slug here.
 */
const MVP_CATEGORY_SLUGS = Object.freeze(['phones', 'smartwatches']);

module.exports = {
  MVP_CATEGORY_SLUGS,
};
