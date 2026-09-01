/**
 * Listing condition display labels.
 * DB/API `conditions.name` stays English; UI text comes from translations.
 */

export function conditionKey(conditionName) {
  return String(conditionName || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
}

export function localizeConditionName(conditionName, t) {
  if (!conditionName) return '';
  const key = conditionKey(conditionName);
  const labels = {
    new: t('conditions.new'),
    likenew: t('conditions.likeNew'),
    usedlikenew: t('conditions.usedlikenew'),
    usedgood: t('conditions.usedgood'),
    usedfair: t('conditions.usedfair'),
    excellent: t('conditions.excellent'),
    verygood: t('conditions.veryGood'),
    good: t('conditions.good'),
    fair: t('conditions.fair'),
    poor: t('conditions.poor'),
    used: t('conditions.used'),
    refurbished: t('conditions.refurbished'),
  };
  return labels[key] || conditionName;
}
