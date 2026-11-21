-- Mahalle Online / Sabri'nin Büfesi: YÖNETİCİ sistemi (Supabase > SQL Editor > New query > yapıştır > Run)
-- Önce supabase-kurulum.sql çalışmış olmalı. Bu dosyayı tekrar çalıştırmak güvenli.
-- Mantık: şifre oyuna gömülmez. Yönetici = "adminler" tablosundaki hesap. Bu tabloya sadece buradan (SQL Editor) satır eklenir,
-- oyuncular ekleyemez. Ban / susturma / komut tabloları da sadece yönetici hesabın yazabileceği şekilde korunur (RLS).

create table if not exists public.adminler (
  id uuid primary key references auth.users on delete cascade,
  eklendi timestamptz not null default now()
);
alter table public.adminler enable row level security;
drop policy if exists "admin kendi satirini gorur" on public.adminler;
create policy "admin kendi satirini gorur" on public.adminler for select using (auth.uid() = id);
-- insert/update/delete politikası YOK: istemciden kimse admin olamaz.

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.adminler where id = auth.uid()); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Yasaklılar: yasaklı hesap oyuna giremez. Hesap sahibi kendi satırını görür (girişte engellenir), yönetici hepsini.
create table if not exists public.yasaklar (
  id uuid primary key references auth.users on delete cascade,
  neden text not null default '',
  bitis timestamptz,                       -- boş = kalıcı
  ekleyen uuid references auth.users,
  zaman timestamptz not null default now()
);
alter table public.yasaklar enable row level security;
drop policy if exists "yasak okuma" on public.yasaklar;
drop policy if exists "yasak yazma" on public.yasaklar;
create policy "yasak okuma" on public.yasaklar for select using (auth.uid() = id or public.is_admin());
create policy "yasak yazma" on public.yasaklar for all using (public.is_admin()) with check (public.is_admin());

-- Susturulanlar: herkes (giriş yapmış) okur ki sohbette o kişinin mesajları gizlensin; sadece yönetici yazar.
create table if not exists public.susturmalar (
  id uuid primary key references auth.users on delete cascade,
  bitis timestamptz,                       -- boş = kalıcı
  zaman timestamptz not null default now()
);
alter table public.susturmalar enable row level security;
drop policy if exists "susturma okuma" on public.susturmalar;
drop policy if exists "susturma yazma" on public.susturmalar;
create policy "susturma okuma" on public.susturmalar for select to authenticated using (true);
create policy "susturma yazma" on public.susturmalar for all using (public.is_admin()) with check (public.is_admin());

-- Komutlar: yönetici bir oyuncuya (hedef) ya da herkese (hedef boş) komut yazar; oyun birkaç saniyede bir kendi satırlarını okur.
create table if not exists public.admin_komut (
  id bigint generated always as identity primary key,
  hedef uuid references auth.users on delete cascade,   -- boş = herkes
  tur text not null check (tur in ('kick','isinla','para','altin','mesaj')),
  veri jsonb not null default '{}'::jsonb,
  olusturan uuid default auth.uid() references auth.users,
  zaman timestamptz not null default now()
);
alter table public.admin_komut enable row level security;
drop policy if exists "komut okuma" on public.admin_komut;
drop policy if exists "komut yazma" on public.admin_komut;
create policy "komut okuma" on public.admin_komut for select to authenticated using (public.is_admin() or hedef = auth.uid() or hedef is null);
create policy "komut yazma" on public.admin_komut for insert to authenticated with check (public.is_admin());

-- SON ADIM: kendi hesabını yönetici yap. Önce oyunda normal "Kayıt ol" ile hesabını aç (kullanıcı adın 'admin' ya da 'xynena' olsun,
-- farklıysa aşağıdaki listeye kendi adını yaz), sonra bunu çalıştır:
insert into public.adminler (id)
select id from public.oyuncular where kullanici_adi in ('admin', 'xynena')
on conflict do nothing;

-- ============ SAĞLAMLAŞTIRMA (tekrar çalıştırmak güvenli) ============
-- 1) Kullanıcı adı büyük/küçük harf farkıyla ikilenemesin
create unique index if not exists oyuncular_ad_kucuk on public.oyuncular (lower(kullanici_adi));
-- 2) Bir oyuncu kendi profilini başkasının id'sine çeviremesin
drop policy if exists "kendi profilini gunceller" on public.oyuncular;
create policy "kendi profilini gunceller" on public.oyuncular for update using (auth.uid() = id) with check (auth.uid() = id);
-- 3) Kayıt boyutu sınırı (şişirilmiş kayıtla veritabanı doldurulamasın)
do $$ begin
  alter table public.kayitlar add constraint kayit_boyut check (octet_length(veri::text) < 3000000) not valid;
exception when duplicate_object then null; end $$;
-- 4) Banlı hesap buluta kayıt yazamaz
create or replace function public.yasakli_mi() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.yasaklar where id = auth.uid() and (bitis is null or bitis > now())); $$;
revoke all on function public.yasakli_mi() from public;
grant execute on function public.yasakli_mi() to authenticated;
drop policy if exists "yasakli kayit yazamaz" on public.kayitlar;
create policy "yasakli kayit yazamaz" on public.kayitlar as restrictive for all using (not public.yasakli_mi()) with check (not public.yasakli_mi());
-- 5) Yönetici banlanamaz / susturulamaz (kazara kendini kilitleme olmasın)
create or replace function public.admin_koru() returns trigger language plpgsql as
$$ begin if exists (select 1 from public.adminler where id = new.id) then raise exception 'Yönetici hesabı banlanamaz'; end if; return new; end; $$;
drop trigger if exists yasak_admin_koru on public.yasaklar;
create trigger yasak_admin_koru before insert or update on public.yasaklar for each row execute function public.admin_koru();
drop trigger if exists susturma_admin_koru on public.susturmalar;
create trigger susturma_admin_koru before insert or update on public.susturmalar for each row execute function public.admin_koru();
-- 6) Komut tablosu şişmesin: indeks + 2 günden eski komutları silen fonksiyon (istersen Supabase > Database > Cron ile günde 1 çalıştır)
create index if not exists admin_komut_hedef on public.admin_komut (hedef, id);
create or replace function public.komut_temizle() returns void language sql security definer set search_path = public as
$$ delete from public.admin_komut where zaman < now() - interval '2 days'; $$;
revoke all on function public.komut_temizle() from public;
-- 7) Yönetici komut yazma: veri boyutu sınırı
do $$ begin
  alter table public.admin_komut add constraint komut_boyut check (octet_length(veri::text) < 2000) not valid;
exception when duplicate_object then null; end $$;

-- 8) Oyuncu bilgisi silme / ayarlama (admin paneli): komut türleri genişledi, admin başkasının bulut kaydını silebilir, profilini sıfırlayabilir
alter table public.admin_komut drop constraint if exists admin_komut_tur_check;
alter table public.admin_komut add constraint admin_komut_tur_check check (tur in ('kick','isinla','para','altin','mesaj','ayarla','sifirla'));
drop policy if exists "admin kayit siler" on public.kayitlar;
create policy "admin kayit siler" on public.kayitlar for delete using (public.is_admin());
drop policy if exists "admin profil gunceller" on public.oyuncular;
create policy "admin profil gunceller" on public.oyuncular for update using (public.is_admin()) with check (public.is_admin());

-- 9) ANAHTAR KOD (2026-10-25): 'admin' ve 'xynena' hesapları sadece şifre + SENDE OLAN anahtar kodlardan biriyle yönetici olur.
-- Dosyada kodların kendisi yok, sadece şifrelenmiş halleri (hash) var. Doğru kod girilince yönetici yetkisi 12 saat açık kalır.
-- 5 yanlış denemeden sonra 15 dakika kilitlenir. Bu bölümü tekrar çalıştırmak güvenli.
create extension if not exists pgcrypto with schema extensions;
alter table public.adminler add column if not exists dogrulandi timestamptz;
drop function if exists public.admin_kod_ayarla(text);
drop table if exists public.admin_kilit;

create table if not exists public.admin_kodlar (id serial primary key, kod_hash text not null unique);
alter table public.admin_kodlar enable row level security;   -- politika yok: istemci bu tabloyu hiç okuyamaz
insert into public.admin_kodlar (kod_hash) values
  ('$2a$10$XoYbG3GsRyJLWpuD7einRuVUrOVuvczcznys/J4CWRk7f3GywVH4K'),
  ('$2a$10$hVgLBki1N64jDRXq1QgG3OT4tKaMDVFYZjot9JvYXDBI3hifPfp8C'),
  ('$2a$10$SM0yEC73QvglWwmwqJTZEuaNUZ3dWNRfQ7ynFUb1s90eGg07W6sg2'),
  ('$2a$10$S.PoK.Nf9eUMvgPxGK680.jZSOZmGMdendH/7NyemuFx2VL1ewE1W'),
  ('$2a$10$0zMO4Wshm7BmckULyiR5nuC7tixbncGHGgwcrJ8qOG2TVEF3k08Qm')
on conflict (kod_hash) do nothing;

create table if not exists public.admin_deneme (id int primary key default 1 check (id = 1), hatali int not null default 0, son_hata timestamptz);
alter table public.admin_deneme enable row level security;
insert into public.admin_deneme (id) values (1) on conflict do nothing;

create or replace function public.admin_dogrula(kod text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare k public.admin_deneme%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from public.adminler where id = auth.uid()) then return false; end if;
  select * into k from public.admin_deneme where id = 1;
  if k.hatali >= 5 and k.son_hata > now() - interval '15 minutes' then return false; end if;
  if exists (select 1 from public.admin_kodlar where kod_hash = crypt(kod, kod_hash)) then
    update public.admin_deneme set hatali = 0 where id = 1;
    update public.adminler set dogrulandi = now() where id = auth.uid();
    return true;
  end if;
  update public.admin_deneme set hatali = case when son_hata > now() - interval '15 minutes' then hatali + 1 else 1 end, son_hata = now() where id = 1;
  return false;
end $$;
revoke all on function public.admin_dogrula(text) from public, anon;
grant execute on function public.admin_dogrula(text) to authenticated;

-- artık yönetici = adminler satırı VE son 12 saatte anahtar kodunu doğrulamış olmak
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.adminler where id = auth.uid() and dogrulandi > now() - interval '12 hours'); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 10) 'admin' ve 'xynena' kullanıcı adı kayıt olunca otomatik yönetici satırı alır (yetki yine de anahtar kodla açılır).
create or replace function public.admin_otomatik() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.kullanici_adi) in ('admin', 'xynena') then insert into public.adminler (id) values (new.id) on conflict do nothing; end if;
  return new;
end $$;
revoke all on function public.admin_otomatik() from public, anon, authenticated;
drop trigger if exists admin_otomatik_t on public.oyuncular;
create trigger admin_otomatik_t after insert on public.oyuncular for each row execute function public.admin_otomatik();
