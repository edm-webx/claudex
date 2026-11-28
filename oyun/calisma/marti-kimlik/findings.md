# Bulgular
- user_metadata.ad oyuncunun auth.updateUser ile değiştirebildiği alan: görünen ad oradan alınıyordu (sahte "admin" mümkündü).
- online.ts presence'taki hn istemci metniydi; admin paneli onu yedek ad olarak kullanıyordu. Artık hn = sunucudan çözülen ad.
- Sınır: presence'taki uid de istemci beyanı. Başka birinin uid'sini (oyuncular herkese okunur) yazan biri o adı gösterebilir. Kesin çözüm sunucu tarafı (Realtime Authorization / DB üzerinden yayın) = Supabase turunda.
- toLocaleLowerCase('tr'): "VELI" -> "velı". Eski davranış, kayıt da aynı kuralı kullanıyor; dokunulmadı.
- Her yanlış giriş 2 istek (iki sahte e-posta). Bozuk ad/boş şifre artık hiç istek atmıyor.
