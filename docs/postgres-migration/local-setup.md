# Yerel PostgreSQL Kurulumu (Docker yok)

Bu makinede **Docker** ve **PostgreSQL client (`psql`)** bulunamadı. Pilot ETL ve migration uygulaması için yerel PostgreSQL gerekir.

## Seçenek A: Docker Desktop (önerilen)

1. [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) kurun.
2. Proje kökünde:

```bash
docker compose -f docker-compose.local.yml up -d
```

3. `.env.local` içine (örnek değerler `.env.example`):

```env
DATABASE_URL=postgresql://acarindex:dev_password_change_me@127.0.0.1:5432/acarindex_dev?schema=public
```

4. Şema:

```bash
npm run db:migrate
```

## Seçenek B: Laragon PostgreSQL

Laragon zaten MySQL için kullanılıyorsa:

1. Laragon → Menu → PostgreSQL → Install (veya ayrı PostgreSQL 16 Windows installer).
2. Veritabanı oluştur: `acarindex_dev`
3. Kullanıcı oluştur (salt okunur ETL reader ayrı; uygulama için `acarindex_app`).
4. `DATABASE_URL` ayarla.

## Seçenek C: Resmi PostgreSQL Windows installer

1. https://www.postgresql.org/download/windows/
2. Port: `5432`, superuser parolasını kaydedin.
3. `createdb acarindex_dev`
4. `DATABASE_URL` ayarla.

## Doğrulama

```bash
npx prisma migrate status
npm run db:schema-report
```

## Kurulum onayı

Otomatik kurulum yapılmadı. PostgreSQL kurulumunu onayladıktan sonra pilot ETL yazma aşamasına geçin.

**Kaynak MySQL** (dump restore) hedeften ayrı tutulur; `SOURCE_MYSQL_URL` yalnızca ETL scriptlerinde kullanılır.
