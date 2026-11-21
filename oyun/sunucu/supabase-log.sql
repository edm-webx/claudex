-- Oturum logu (2026-10-27): kim girdi, ne yazdı. Sadece yönetici okur. Supabase > SQL Editor'de BİR KEZ çalıştır.
-- Önce supabase-admin.sql çalışmış olmalı (is_admin() fonksiyonu oradan gelir). Tekrar çalıştırmak zararsız.
create table if not exists public.oturum_log (
  id bigserial primary key,
  uid uuid not null default auth.uid(),
  ad text not null default '',
  tur text not null check (tur in ('giris', 'cikis', 'sohbet', 'pm', 'karakter')),
  metin text not null default '' check (char_length(metin) <= 300),
  veri jsonb not null default '{}'::jsonb,
  sunucu int,
  zaman timestamptz not null default now()
);
create index if not exists oturum_log_zaman on public.oturum_log (id desc);
alter table public.oturum_log enable row level security;
drop policy if exists "log yaz" on public.oturum_log;
drop policy if exists "log oku" on public.oturum_log;
drop policy if exists "log sil" on public.oturum_log;
-- herkes sadece KENDİ adına satır ekler; okuma ve silme sadece yönetici
create policy "log yaz" on public.oturum_log for insert to authenticated with check (uid = auth.uid());
create policy "log oku" on public.oturum_log for select to authenticated using (public.is_admin());
create policy "log sil" on public.oturum_log for delete to authenticated using (public.is_admin());
-- 90 günden eski satırları temizlemek için (isteğe bağlı, elle): delete from public.oturum_log where zaman < now() - interval '90 days';
