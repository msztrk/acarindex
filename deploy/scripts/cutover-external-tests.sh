#!/usr/bin/env bash
# Post-cutover external tests — run on server after cutover-apply.sh
set -euo pipefail

PROBE_USER="$1"
PROBE_PASS="$2"
BASE="https://beta.acarindex.com"
AUTH="-u ${PROBE_USER}:${PROBE_PASS}"
FAIL=0

check_code() {
  local label="$1"
  local url="$2"
  local expect="$3"
  local extra="${4:-}"
  local code
  if [[ -n "$extra" ]]; then
    code=$(curl -sS -o /tmp/cutover_body -w "%{http_code}" $extra "$url")
  else
    code=$(curl -sS -o /tmp/cutover_body -w "%{http_code}" "$url")
  fi
  if [[ "$code" == "$expect" ]]; then
    echo "OK $label $code $url"
  else
    echo "FAIL $label expected=$expect got=$code $url"
    FAIL=1
  fi
}

echo "=== NO AUTH 401 ==="
check_code "noauth_root" "$BASE/" "401"

echo "=== BASIC AUTH 200 ==="
for path in \
  "/" \
  "/api/health" \
  "/search?q=enerji" \
  "/journals" \
  "/istatistikler" \
  "/sitemap.xml" \
  "/robots.txt" \
  "/nonexistent-route-cutover-test-404"
do
  if [[ "$path" == "/nonexistent-route-cutover-test-404" ]]; then
    check_code "auth_404" "${BASE}${path}" "404" "$AUTH"
  else
    check_code "auth" "${BASE}${path}" "200" "$AUTH"
  fi
done

echo "=== JOURNALS ==="
for slug in enderun abant-izzet-baysal-universitesi-egitim-fakultesi-dergisi manas-sosyal-arastirmalar-dergisi; do
  check_code "journal" "${BASE}/journals/${slug}" "200" "$AUTH"
done

echo "=== ISSUES ==="
for path in \
  "/journals/enderun/sayi-Cilt:%204%20-%20Say%C4%B1:%201" \
  "/journals/enderun/sayi-Cilt:%203%20-%20Say%C4%B1:%202" \
  "/journals/enderun/sayi-Cilt:%203%20-%20Say%C4%B1:%201"
do
  check_code "issue" "${BASE}${path}" "200" "$AUTH"
done

echo "=== ARTICLES ==="
articles=(
  "/enderun/turkiyede-buyuksehir-belediyelerinin-metropollerin-yapisal-orgutsel-ve-yonetsel-sorunlari-uzerine-bir-inceleme-18"
  "/enderun/laikligin-dusunsel-temelleri-uzerine-bir-degerlendirme-19"
  "/enderun/askeri-teskillerde-silah-arkadasliginin-tesisi-uzerine-kavramsal-bir-calisma-20"
  "/enderun/turkiyede-hanehalkinin-ozel-sigorta-tercihleri-21"
  "/enderun/kitap-kritigi-refah-devletinin-krizi-22"
  "/enderun/surdurulebilir-kalkinma-ve-dongusel-ekonominin-bibliyometrigi-23"
  "/enderun/laiklik-ve-ideolojiler-arasindaki-iliskiyi-anlamak-24"
  "/enderun/kamu-gorevlilerini-yoldan-cikaran-bubi-tuzaklari-hediye-ve-bagislar-25"
  "/enderun/kargo-hizmetlerinin-tuketici-davranislarina-etkisi-uzerine-bir-calisma-suleyman-demirel-universitesi-ornegi-26"
  "/enderun/kaybolan-baglar-depresyonun-gercek-nedenleri-ve-beklenmedik-cozumler-27"
)
for p in "${articles[@]}"; do
  check_code "article" "${BASE}${p}" "200" "$AUTH"
done

echo "=== AUTHORS ==="
for p in "/authors/yusuf-cifci-542" "/authors/ozcan-tunahan-543" "/authors/murat-sengoz-544"; do
  check_code "author" "${BASE}${p}" "200" "$AUTH"
done

echo "=== PDF VIEWER ==="
for id in 18 19 20 21 22; do
  check_code "pdf_viewer" "${BASE}/pdfs/${id}" "200" "$AUTH"
done

echo "=== PDF PROXY ==="
for id in 18 19 20 21 22; do
  ct=$(curl -sS -o /tmp/pdf.bin -w "%{http_code}:%{content_type}:%{size_download}" $AUTH "${BASE}/api/pdf-proxy/${id}")
  head5=$(head -c 5 /tmp/pdf.bin)
  if [[ "$ct" =~ ^200:application/pdf: ]] && [[ "$head5" == "%PDF-" ]]; then
    echo "OK pdf_proxy $ct id=$id"
  else
    echo "FAIL pdf_proxy $ct head=$head5 id=$id"
    FAIL=1
  fi
done

echo "=== ROBOTS.TXT CONTENT ==="
curl -sS $AUTH "${BASE}/robots.txt" | head -3

echo "=== SEO HEADERS ==="
curl -sS -I $AUTH "${BASE}/" | tr -d '\r' | grep -iE 'x-robots-tag|401|200' || true

echo "=== META ROBOTS (HTML) ==="
curl -sS $AUTH "${BASE}/" | grep -oi '<meta[^>]*robots[^>]*>' | head -3

echo "=== CANONICAL ==="
curl -sS $AUTH "${BASE}/" | grep -oi '<link[^>]*canonical[^>]*>' | head -2

echo "=== HTTP->HTTPS ==="
http_code=$(curl -sS -o /dev/null -w "%{http_code}" "http://beta.acarindex.com/")
echo "HTTP redirect code: $http_code"

echo "=== PORT EXPOSURE ==="
ss -tlnp | grep -E ':5432|:3306|:3002' || true

echo "=== SECRETS IN RESPONSE ==="
body=$(curl -sS $AUTH "${BASE}/")
if echo "$body" | grep -qiE 'postgresql://|mysql://|password|stack trace|Error:.*at '; then
  echo "WARN possible secret/leak in homepage"
  FAIL=1
else
  echo "OK no obvious secrets in homepage"
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "EXTERNAL_TESTS_FAILED"
  exit 1
fi
echo "EXTERNAL_TESTS_OK"
