#!/usr/bin/env bash
set -euo pipefail
COMPOSE="docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml"
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (
    'users','user_credentials','sessions','verification_tokens','password_reset_tokens',
    'roles','user_roles','audit_logs','login_attempts','author_claims') ORDER BY 1;"
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT 'journals' AS t, count(*)::int AS n FROM journals;
   SELECT 'issues', count(*)::int FROM issues;
   SELECT 'articles', count(*)::int FROM articles;
   SELECT 'authors', count(*)::int FROM authors;
   SELECT 'article_authors', count(*)::int FROM article_authors;
   SELECT 'pdf_files', count(*)::int FROM pdf_files;"
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c "SELECT id, name FROM roles ORDER BY id;"
