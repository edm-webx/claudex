-- Sabri'nin Büfesi / Martıköy online: Supabase kurulumu (SQL Editor > New query > yapıştır > Run)
-- Oyuncunun herkese açık profili: kullanıcı adı, esnaf görünüşü, sınıf
create table if not exists public.oyuncular (
  id uuid primary key references auth.users on delete cascade,
  kullanici_adi text unique not null check (char_length(kullanici_adi) between 3 and 16),
  esnaf jsonb not null default '{}'::jsonb,
  guncellendi timestamptz not null default now()
);
alter table public.oyuncular enable row level security;
create policy "profiller herkese acik" on public.oyuncular for select using (true);
create policy "kendi profilini ekler" on public.oyuncular for insert with check (auth.uid() = id);
create policy "kendi profilini gunceller" on public.oyuncular for update using (auth.uid() = id);

-- Oyun kaydı: sadece sahibi okur ve yazar
create table if not exists public.kayitlar (
  id uuid primary key references auth.users on delete cascade,
  veri jsonb not null,
  guncellendi timestamptz not null default now()
);
alter table public.kayitlar enable row level security;
create policy "kendi kaydini okur" on public.kayitlar for select using (auth.uid() = id);
create policy "kendi kaydini ekler" on public.kayitlar for insert with check (auth.uid() = id);
create policy "kendi kaydini gunceller" on public.kayitlar for update using (auth.uid() = id);
