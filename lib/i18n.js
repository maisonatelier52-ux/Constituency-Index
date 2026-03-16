import en from '@/locales/en';
import hi from '@/locales/hi';
import ml from '@/locales/ml';

export const dictionary = {
  en,
  hi: { ...en, ...hi },
  ml: { ...en, ...ml }
};

export function t(locale = 'en', key) {
  const lang = dictionary[locale] ? locale : 'en';
  return dictionary[lang][key] || dictionary.en[key] || key;
}
