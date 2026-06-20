/**
 * urlYap — PHP'den birebir taşınmış slug üretici
 *
 * PHP orijinal (include/2VeriKatmani.php):
 *   remove_accent() → strtolower + preg_replace
 *   /[^a-zA-Z0-9 -]/ → ''
 *   /[ -]+/           → '-'
 *   /^-|-$/           → ''
 *
 * Bu implementasyon tüm PHP davranışıyla eşleşmeli.
 * Parity testleri: tests/urls.test.ts
 */

const ACCENT_MAP: Record<string, string> = {
  À: 'A', Á: 'A', Â: 'A', Ã: 'A', Ä: 'A', Å: 'A', Æ: 'AE',
  Ç: 'C',
  È: 'E', É: 'E', Ê: 'E', Ë: 'E',
  Ì: 'I', Í: 'I', Î: 'I', Ï: 'I',
  Ð: 'D', Ñ: 'N',
  Ò: 'O', Ó: 'O', Ô: 'O', Õ: 'O', Ö: 'O', Ø: 'O',
  Ù: 'U', Ú: 'U', Û: 'U', Ü: 'U',
  Ý: 'Y', ß: 's',
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a', æ: 'ae',
  ç: 'c',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ñ: 'n',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ø: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ý: 'y', ÿ: 'y',
  // Extended Latin
  Ā: 'A', ā: 'a', Ă: 'A', ă: 'a', Ą: 'A', ą: 'a',
  Ć: 'C', ć: 'c', Ĉ: 'C', ĉ: 'c', Ċ: 'C', ċ: 'c', Č: 'C', č: 'c',
  Ď: 'D', ď: 'd', Đ: 'D', đ: 'd',
  Ē: 'E', ē: 'e', Ĕ: 'E', ĕ: 'e', Ė: 'E', ė: 'e', Ę: 'E', ę: 'e', Ě: 'E', ě: 'e',
  Ĝ: 'G', ĝ: 'g', Ğ: 'G', ğ: 'g', Ġ: 'G', ġ: 'g', Ģ: 'G', ģ: 'g',
  Ĥ: 'H', ĥ: 'h', Ħ: 'H', ħ: 'h',
  Ĩ: 'I', ĩ: 'i', Ī: 'I', ī: 'i', Ĭ: 'I', ĭ: 'i', Į: 'I', į: 'i',
  İ: 'I', ı: 'i',
  Ĳ: 'IJ', ĳ: 'ij',
  Ĵ: 'J', ĵ: 'j',
  Ķ: 'K', ķ: 'k',
  Ĺ: 'L', ĺ: 'l', Ļ: 'L', ļ: 'l', Ľ: 'L', ľ: 'l', Ŀ: 'L', ŀ: 'l', Ł: 'L', ł: 'l',
  Ń: 'N', ń: 'n', Ņ: 'N', ņ: 'n', Ň: 'N', ň: 'n', ŉ: 'n',
  Ō: 'O', ō: 'o', Ŏ: 'O', ŏ: 'o', Ő: 'O', ő: 'o', Œ: 'OE', œ: 'oe',
  Ŕ: 'R', ŕ: 'r', Ŗ: 'R', ŗ: 'r', Ř: 'R', ř: 'r',
  Ś: 'S', ś: 's', Ŝ: 'S', ŝ: 's', Ş: 'S', ş: 's', Š: 'S', š: 's',
  Ţ: 'T', ţ: 't', Ť: 'T', ť: 't', Ŧ: 'T', ŧ: 't',
  Ũ: 'U', ũ: 'u', Ū: 'U', ū: 'u', Ŭ: 'U', ŭ: 'u', Ů: 'U', ů: 'u', Ű: 'U', ű: 'u', Ų: 'U', ų: 'u',
  Ŵ: 'W', ŵ: 'w',
  Ŷ: 'Y', ŷ: 'y', Ÿ: 'Y',
  Ź: 'Z', ź: 'z', Ż: 'Z', ż: 'z', Ž: 'Z', ž: 'z',
  ſ: 's', ƒ: 'f',
  Ơ: 'O', ơ: 'o', Ư: 'U', ư: 'u',
  Ǎ: 'A', ǎ: 'a', Ǐ: 'I', ǐ: 'i', Ǒ: 'O', ǒ: 'o', Ǔ: 'U', ǔ: 'u',
  Ǖ: 'U', ǖ: 'u', Ǘ: 'U', ǘ: 'u', Ǚ: 'U', ǚ: 'u', Ǜ: 'U', ǜ: 'u',
  Ǻ: 'A', ǻ: 'a', Ǽ: 'AE', ǽ: 'ae', Ǿ: 'O', ǿ: 'o',
}

function removeAccent(str: string): string {
  return str
    .split('')
    .map((ch) => ACCENT_MAP[ch] ?? ch)
    .join('')
}

/**
 * Birebir PHP urlYap() karşılığı.
 * Null / undefined girdide boş string döner.
 */
export function urlYap(input: string | null | undefined): string {
  if (!input) return ''

  const withoutAccents = removeAccent(input)
  return withoutAccents
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')   // harfler + rakamlar + boşluk + tire dışı → sil
    .replace(/[ -]+/g, '-')         // boşluk ve tire grubunu tek tireye
    .replace(/^-|-$/g, '')          // baş/son tireyi kaldır
}
