export const OFFICE_LEVELS = [
  'union_minister',
  'mp_lok_sabha',
  'mp_rajya_sabha',
  'mla',
  'panchayat_member',
  'municipal_councillor',
  'other_local_representative'
];

export const JURISDICTION_TYPES = [
  'country',
  'state',
  'district',
  'block',
  'panchayat',
  'ward',
  'constituency',
  'municipality',
  'other'
];

export const STATUS_TYPES = ['active', 'inactive', 'vacant', 'unknown'];

export const LOCAL_BODY_TYPES = [
  'district_panchayat',
  'block_panchayat',
  'grama_panchayat',
  'municipality',
  'corporation',
  'other'
];

export const KERALA_DISTRICT_CODE_MAP = {
  '01': 'Thiruvananthapuram',
  '02': 'Kollam',
  '03': 'Pathanamthitta',
  '04': 'Alappuzha',
  '05': 'Kottayam',
  '06': 'Idukki',
  '07': 'Ernakulam',
  '08': 'Thrissur',
  '09': 'Palakkad',
  '10': 'Malappuram',
  '11': 'Kozhikode',
  '12': 'Wayanad',
  '13': 'Kannur',
  '14': 'Kasaragod'
};

export const KERALA_DISTRICTS = Object.values(KERALA_DISTRICT_CODE_MAP);

export const REQUIRED_REPRESENTATIVE_FIELDS = [
  'full_name',
  'office_level',
  'office_title',
  'jurisdiction_type',
  'jurisdiction_code',
  'state',
  'party',
  'term_start',
  'term_end',
  'source_url',
  'source_last_updated',
  'status'
];

export const JURISDICTION_HIERARCHY = ['country', 'state', 'district', 'block', 'panchayat/ward'];

export function slugifyPersonName(name = '') {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 120);
}

export function buildRepresentativeCanonicalId({
  country = 'IN',
  officeLevel = 'other_local_representative',
  jurisdictionCode = '',
  fullName = ''
}) {
  const personSlug = slugifyPersonName(fullName || 'unknown');
  return `${String(country).toUpperCase()}:${officeLevel}:${String(jurisdictionCode).trim()}:${personSlug}`;
}
