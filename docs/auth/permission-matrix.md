# Yetki matrisi (Faz 6A)

Server-side kontrol `lib/auth/roles.ts` içindeki `PERMISSION_MATRIX` ile yapılır. Client UI gizleme yetkilendirme değildir.

| Rol | Admin panel | Veri kalitesi | Kullanıcı yönetimi | SUPER_ADMIN atama |
|-----|-------------|---------------|--------------------|-------------------|
| USER | — | — | — | — |
| EDITOR | ✓ | — | — | — |
| MODERATOR | ✓ | ✓ | — | — |
| ADMIN | ✓ | ✓ | ✓ | — |
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ |

## Kurallar

- SUPER_ADMIN yalnızca başka SUPER_ADMIN atayabilir/kaldırabilir.
- Son aktif SUPER_ADMIN rolü kaldırılamaz.
- Pasif (`disabled`) hesap giriş yapamaz.
- Açık kayıt kapalı; bootstrap veya admin ile kullanıcı oluşturma.
