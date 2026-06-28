// Maps ISO 3166-1 alpha-2 country code → location key in LOCATIONS
// Used when ip-api.com returns a countryCode for the detected proxy IP
export const COUNTRY_TO_LOCATION: Record<string, string> = {
  AU: 'sydney',      NZ: 'auckland',    JP: 'tokyo',       KR: 'seoul',
  SG: 'singapore',   CN: 'beijing',     HK: 'hongKong',    IN: 'delhi',
  AE: 'dubai',       IR: 'tehran',      RU: 'saintPetersburg', TR: 'istanbul',
  UA: 'kyiv',        PL: 'warsaw',      DE: 'berlin',      FR: 'paris',
  GB: 'london',      NL: 'amsterdam',   ES: 'madrid',      IT: 'rome',
  EG: 'cairo',       NG: 'lagos',       KE: 'nairobi',     US: 'newYork',
  CA: 'toronto',     BR: 'saoPaulo',    MX: 'mexicoCity',  CO: 'bogota',
  AR: 'buenosAires',
};

// Maps ISO country code → BCP-47 locale, used when ip-api returns a country
// for which we have no exact city in LOCATIONS (Sync to IP feature).
const COUNTRY_TO_LOCALE: Record<string, string> = {
  AU: 'en-AU', NZ: 'en-NZ', JP: 'ja-JP', KR: 'ko-KR', SG: 'en-SG', CN: 'zh-CN',
  HK: 'zh-HK', IN: 'en-IN', AE: 'ar-AE', IR: 'fa-IR', RU: 'ru-RU', TR: 'tr-TR',
  UA: 'uk-UA', PL: 'pl-PL', DE: 'de-DE', FR: 'fr-FR', GB: 'en-GB', NL: 'nl-NL',
  ES: 'es-ES', IT: 'it-IT', EG: 'ar-EG', NG: 'en-NG', KE: 'en-KE', US: 'en-US',
  CA: 'en-CA', BR: 'pt-BR', MX: 'es-MX', CO: 'es-CO', AR: 'es-AR', CH: 'de-CH',
  AT: 'de-AT', BE: 'nl-BE', SE: 'sv-SE', NO: 'nb-NO', DK: 'da-DK', FI: 'fi-FI',
  PT: 'pt-PT', GR: 'el-GR', CZ: 'cs-CZ', RO: 'ro-RO', HU: 'hu-HU', IE: 'en-IE',
  IL: 'he-IL', SA: 'ar-SA', TH: 'th-TH', VN: 'vi-VN', ID: 'id-ID', MY: 'ms-MY',
  PH: 'en-PH', ZA: 'en-ZA', CL: 'es-CL', PE: 'es-PE',
};

export function localeForCountry(countryCode: string): string {
  return COUNTRY_TO_LOCALE[countryCode.toUpperCase()] ?? 'en-US';
}
