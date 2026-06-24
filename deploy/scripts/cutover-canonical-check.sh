#!/usr/bin/env bash
PROBE_USER=canon_chk
PROBE_PASS=$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)
htpasswd -bB /etc/nginx/.htpasswd-acarindex-beta "$PROBE_USER" "$PROBE_PASS"
AUTH="-u ${PROBE_USER}:${PROBE_PASS}"
URL="https://beta.acarindex.com/enderun/turkiyede-buyuksehir-belediyelerinin-metropollerin-yapisal-orgutsel-ve-yonetsel-sorunlari-uzerine-bir-inceleme-18"
curl -sS $AUTH "$URL" | grep -oE 'https://www\.acarindex\.com[^"<> ]*' | head -5
curl -sS $AUTH "https://beta.acarindex.com/" | grep -oE 'https://www\.acarindex\.com[^"<> ]*' | head -3
htpasswd -D /etc/nginx/.htpasswd-acarindex-beta "$PROBE_USER"
