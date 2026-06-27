// Maps ISO 3166-1 alpha-2 country code → location key in LOCATIONS
// Used when ip-api.com returns a countryCode for the detected proxy IP
export const COUNTRY_TO_LOCATION: Record<string, string> = {
  AU: 'sydney',      NZ: 'auckland',    JP: 'tokyo',       KR: 'seoul',
  SG: 'singapore',   CN: 'beijing',     HK: 'hongKong',    IN: 'delhi',
  AE: 'dubai',       IR: 'tehran',      RU: 'moscow',      TR: 'istanbul',
  UA: 'kyiv',        PL: 'warsaw',      DE: 'berlin',      FR: 'paris',
  GB: 'london',      NL: 'amsterdam',   ES: 'madrid',      IT: 'rome',
  EG: 'cairo',       NG: 'lagos',       KE: 'nairobi',     US: 'newYork',
  CA: 'toronto',     BR: 'saoPaulo',    MX: 'mexicoCity',  CO: 'bogota',
  AR: 'buenosAires',
};
