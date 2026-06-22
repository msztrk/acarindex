# Rollback checklist

1. Önceki Docker image tag'ine dön: `docker compose -f docker-compose.production.yml pull && docker compose up -d`
2. PostgreSQL snapshot restore gerekirse: `deploy/scripts/restore-db.sh` (sunucuda)
3. Nginx upstream eski container'a yönlendir
4. DNS değişikliği yapıldıysa geri al
5. ETL partial run sonrası: hedef DB snapshot'tan restore; kaynak MySQL'e dokunulmadığını doğrula
