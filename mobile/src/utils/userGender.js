export const USER_GENDERS = ['male', 'female'];

export function userGenderLabel(gender, t) {
  if (gender === 'male') return t?.('register.male') || 'Male';
  if (gender === 'female') return t?.('register.female') || 'Female';
  return '';
}
