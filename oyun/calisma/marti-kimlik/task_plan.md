# Martı Kimlik (2026-11-23)
Spec (Supabase denetimi + kullanıcı "olur başla kafana göre"): yalnız oyun kodu, SQL/Supabase yazımı yok.
1. Kayıtta oyuncular satırı yazılamazsa net hata (1 yeniden deneme, olmazsa oturum kapanır); girişte eksik profil onarılır. ✓
2. Görünen hesap adı = sunucudaki oyuncular.kullanici_adi (kendi + başkaları); user_metadata ve presence "hn" gösterilmez. ✓
3. Giriş ekranı "Martı Kimlik" rozeti + metinler. ✓
4. Hata mesajları: ad/şifre ayrımı yok ama yol gösterir; bozuk ad/boş şifre sunucuya gitmez; "Şifremi unuttum → admine yaz" (2 hatalı denemede kendiliğinden açılır). ✓
5. Testler: tests/unit/net/marti-kimlik.test.ts (sahte supabase-js). ✓
Yapılmadı (bilerek): sahte e-posta alan adı değişikliği (alan adı bekleniyor), gerçek şifre sıfırlama.
