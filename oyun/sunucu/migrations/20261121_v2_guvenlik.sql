-- v2.0 Supabase sertleştirme (2026-11-21). Önceki kurulum: ../supabase-kurulum.sql -> supabase-admin.sql -> supabase-log.sql.
-- Tekrar çalıştırılabilir (idempotent). Girişi, kaydı, karakter silmeyi, admin logunu bozmaz.

-- 1) Yönetici satırları: admin/xynena hesapları admin_otomatik tetikleyicisinden ÖNCE açıldığı için adminler boştu.
insert into public.adminler (id)
  select id from public.oyuncular where lower(kullanici_adi) in ('admin', 'xynena')
  on conflict do nothing;

-- 2) SECURITY DEFINER fonksiyonlar: misafir (anon) çağıramaz; olmayan işler kimseye açık değil.
revoke execute on function public.is_admin()        from public, anon;
revoke execute on function public.yasakli_mi()      from public, anon;
grant  execute on function public.is_admin()        to authenticated;   -- RLS politikaları ve oyun (rpc is_admin) kullanır
grant  execute on function public.yasakli_mi()      to authenticated;   -- kayitlar politikası kullanır
revoke execute on function public.komut_temizle()   from public, anon, authenticated;  -- oyunda çağrılmıyor
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;  -- olay tetikleyicisi, çağrı izni gerekmez
revoke execute on function public.admin_koru()      from public, anon, authenticated;  -- tetikleyici
revoke execute on function public.admin_otomatik()  from public, anon, authenticated;  -- tetikleyici
revoke execute on function public.admin_dogrula(text) from public, anon;
grant  execute on function public.admin_dogrula(text) to authenticated;
alter function public.admin_koru() set search_path = public;

-- 3) Fonksiyon çağıran politikalar sadece giriş yapmış oyuncuya (anon'da "permission denied" yerine boş sonuç).
alter policy "yasak okuma"        on public.yasaklar    to authenticated;
alter policy "yasak yazma"        on public.yasaklar    to authenticated;
alter policy "susturma yazma"     on public.susturmalar to authenticated;
alter policy "yasakli kayit yazamaz" on public.kayitlar to authenticated;
alter policy "admin kayit siler"  on public.kayitlar    to authenticated;
alter policy "admin profil gunceller" on public.oyuncular to authenticated;
alter policy "kendi kaydini okur"     on public.kayitlar to authenticated;
alter policy "kendi kaydini ekler"    on public.kayitlar to authenticated;
alter policy "kendi kaydini gunceller" on public.kayitlar to authenticated;
alter policy "kendi profilini ekler"   on public.oyuncular to authenticated;
alter policy "kendi profilini gunceller" on public.oyuncular to authenticated;
alter policy "admin kendi satirini gorur" on public.adminler to authenticated;

-- 4) Gizli tablolar: RLS açık + politika yok = kimse okuyamaz (bilerek). Tablo izinlerini de kapat.
revoke all on table public.admin_kodlar, public.admin_deneme from anon, authenticated;
revoke all on table public.adminler from anon;
grant select on table public.adminler to authenticated;

-- 5) Kullanıcı adı: oyundaki kuralın aynısı (küçük harf, 3-16) ve sonradan DEĞİŞTİRİLEMEZ
--    (yoksa biri adını "admin"e çevirip taklit edebilirdi). Ad değiştirmek = admin SQL'i.
alter table public.oyuncular drop constraint if exists oyuncular_ad_bicim;
alter table public.oyuncular add constraint oyuncular_ad_bicim check (kullanici_adi ~ '^[a-z0-9_çğıöşü]{3,16}$') not valid;
alter table public.oyuncular validate constraint oyuncular_ad_bicim;
create or replace function public.ad_degismez() returns trigger language plpgsql set search_path = public as
$$ begin
  if new.kullanici_adi is distinct from old.kullanici_adi and coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Kullanıcı adı değiştirilemez';
  end if;
  return new;
end $$;
revoke execute on function public.ad_degismez() from public, anon, authenticated;
drop trigger if exists ad_degismez_t on public.oyuncular;
create trigger ad_degismez_t before update on public.oyuncular for each row execute function public.ad_degismez();

-- 6) Boyut sınırları (kötü niyetli dev veri): profil görünümü ve log satırı.
alter table public.oyuncular drop constraint if exists esnaf_boyut;
alter table public.oyuncular add constraint esnaf_boyut check (octet_length(esnaf::text) < 20000) not valid;
alter table public.oyuncular validate constraint esnaf_boyut;
alter table public.oturum_log drop constraint if exists log_veri_boyut;
alter table public.oturum_log add constraint log_veri_boyut check (octet_length(veri::text) < 4000) not valid;
alter table public.oturum_log validate constraint log_veri_boyut;
