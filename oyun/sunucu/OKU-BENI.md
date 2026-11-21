# Supabase (proje ref fxvbtfkvpnrnhyuntcgj)

Sıra: `supabase-kurulum.sql` -> `supabase-admin.sql` -> `supabase-log.sql` -> `migrations/20261121_v2_guvenlik.sql`.
Hepsi canlı veritabanında uygulanmış durumda (2026-11-21). Yeni bir Supabase projesi kurulursa bu sırayla çalıştır.

- Kayıt yapısı: tek satır `kayitlar.veri` = { aktif, slots[4], banka, code, playT } (bkz. src/game/net/slots.ts). Karakter silme istemci tarafında o yuvayı null yapıp yazar.
- Yönetici: `adminler` satırı + gizli anahtar kod (`admin_dogrula`, 12 saat). Kodlar sadece kullanıcıda.
- `v2-final-hesap-silme.sql`: v2.0 yayınında TÜM hesapları siler. Sadece kullanıcının açık onayıyla.
- Dashboard ayarı (SQL ile yapılamaz): Authentication > Sign In / Providers > Email > "Prevent use of leaked passwords" açık olmalı (Pro plan özelliği olabilir).
