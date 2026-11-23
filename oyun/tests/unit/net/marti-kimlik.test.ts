import { describe, it, expect, vi, beforeEach } from 'vitest';
// MARTI KİMLİK (2026-11-23, Supabase denetimi): kayıt/giriş akışları sahte Supabase istemcisiyle kilitli.
// Bulut thread'leri supabase.co'ya ulaşamaz; gerçek sunucu testi PC'de.
type Hata = { message: string } | null;
const S = vi.hoisted(() => ({
  users: new Map<string, { id: string; sifre: string; meta: Record<string, unknown> }>(),   // email -> kullanıcı
  profil: new Map<string, string>(),                                                        // id -> kullanici_adi
  upsertHata: 0, okuHata: false, agHata: false, signIn: 0, signUp: 0, signOut: 0, upserts: [] as { id: string; kullanici_adi: string }[],
}));
vi.mock('@supabase/supabase-js', () => {
  const sess = (email: string) => { const u = S.users.get(email)!; return { access_token: 't', user: { id: u.id, email, user_metadata: u.meta } }; };
  const from = (t: string) => {
    let f: [string, string] | null = null;
    const b = {
      select: () => b,
      eq: (k: string, v: string) => { f = [k, v]; return b; },
      maybeSingle: async () => {
        if (S.agHata) throw new Error('Failed to fetch');
        if (S.okuHata) return { data: null, error: { message: 'boom' } };
        if (t !== 'oyuncular' || !f) return { data: null, error: null };
        if (f[0] === 'id') { const a = S.profil.get(f[1]); return { data: a ? { kullanici_adi: a } : null, error: null }; }
        const id = [...S.profil].find(([, a]) => a === f![1])?.[0]; return { data: id ? { id } : null, error: null };
      },
      upsert: async (r: { id: string; kullanici_adi: string }) => { S.upserts.push(r); if (S.upsertHata > 0) { S.upsertHata--; return { error: { message: 'Failed to fetch' } }; } S.profil.set(r.id, r.kullanici_adi); return { error: null }; },
    };
    return b;
  };
  return { createClient: () => ({
    from,
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => { S.signOut++; return { error: null }; },
      signUp: async ({ email, password, options }: { email: string; password: string; options: { data: Record<string, unknown> } }) => {
        S.signUp++; if (S.agHata) return { data: { session: null, user: null }, error: { message: 'Failed to fetch' } as Hata };
        S.users.set(email, { id: 'id-' + S.users.size, sifre: password, meta: options.data }); return { data: { session: sess(email), user: null }, error: null as Hata };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        S.signIn++; if (S.agHata) return { data: { session: null }, error: { message: 'Failed to fetch' } as Hata };
        const u = S.users.get(email); if (!u || u.sifre !== password) return { data: { session: null }, error: { message: 'Invalid login credentials' } as Hata };
        return { data: { session: sess(email) }, error: null as Hata };
      },
    },
  }) };
});
type Supa = typeof import('../../../src/game/net/supa');
let m: Supa;
beforeEach(async () => {
  S.users.clear(); S.profil.clear(); S.upsertHata = 0; S.okuHata = false; S.agHata = false; S.signIn = S.signUp = S.signOut = 0; S.upserts.length = 0;
  vi.resetModules(); m = await import('../../../src/game/net/supa');
});

describe('kayıt', () => {
  it('normal kayıt: profil satırı yazılır, görünen ad sunucudaki ad', async () => {
    expect(await m.kayitOl('Ali_01', 'gizli12')).toBeNull();
    expect(m.hesap()?.ad).toBe('ali_01');
    expect([...S.profil.values()]).toEqual(['ali_01']);
  });
  it('profil yazımı bir kez koparsa yeniden dener ve tamamlar', async () => {
    S.upsertHata = 1;
    expect(await m.kayitOl('ali', 'gizli12')).toBeNull();
    expect(S.upserts.length).toBe(2); expect(S.profil.size).toBe(1);
  });
  it('profil hiç yazılamazsa net hata + oturum kapanır; sonraki giriş profili onarır', async () => {
    S.upsertHata = 2;
    expect(await m.kayitOl('çiğdem', 'gizli12')).toBe(m.PROFIL_YAZILAMADI);
    expect(m.hesap()).toBeNull(); expect(S.signOut).toBe(1); expect(S.profil.size).toBe(0);
    expect(await m.girisYap('Çiğdem ', 'gizli12')).toBeNull();
    expect([...S.profil.values()]).toEqual(['çiğdem']);
    expect(m.hesap()?.ad).toBe('çiğdem');
  });
  it('ad kontrolü sunucuya ulaşamazsa kayıt denenmez (yarım hesap açılmaz)', async () => {
    S.agHata = true;
    expect(await m.kayitOl('ali', 'gizli12')).toMatch(/ulaşılamadı/);
    expect(S.signUp).toBe(0);
  });
  it('alınmış ad ve kurala uymayan ad', async () => {
    S.profil.set('x', 'ali');
    expect(await m.kayitOl('ali', 'gizli12')).toBe('Bu kullanıcı adı alınmış.');
    expect(await m.kayitOl('a b', 'gizli12')).toBe(m.AD_KURALI);
    expect(S.signUp).toBe(0);
  });
});

describe('giriş', () => {
  const hazir = async (ad: string, sifre = 'gizli12') => { await m.kayitOl(ad, sifre); await m.cikisYap(); S.signIn = 0; };
  it('görünen ad user_metadata değil sunucudaki kayıtlı ad ("admin" taklidi olmaz)', async () => {
    await hazir('ali');
    for (const u of S.users.values()) u.meta = { ad: 'admin' };   // oyuncu kendi meta verisini değiştirdi
    expect(await m.girisYap('ali', 'gizli12')).toBeNull();
    expect(m.hesap()?.ad).toBe('ali');
  });
  it('eksik profil girişte kendini onarır', async () => {
    await hazir('veli'); S.profil.clear();
    expect(await m.girisYap('Veli', 'gizli12')).toBeNull();
    expect([...S.profil.values()]).toEqual(['veli']);
  });
  it('profil okunamasa da giriş açılır, ad e-postadan (meta değil)', async () => {
    await hazir('şükrü');
    for (const u of S.users.values()) u.meta = { ad: 'admin' };
    S.okuHata = true;
    expect(await m.girisYap('şükrü', 'gizli12')).toBeNull();
    expect(m.hesap()?.ad).toBe('şükrü');
  });
  it('yanlış şifre / olmayan kullanıcı aynı yol gösteren mesaj (bilgi sızmaz)', async () => {
    await hazir('ali');
    expect(await m.girisYap('ali', 'yanlis1')).toBe(m.GIRIS_TUTMADI);
    expect(await m.girisYap('yokboyle', 'gizli12')).toBe(m.GIRIS_TUTMADI);
    expect(m.GIRIS_TUTMADI).toMatch(/Kayıt ol/);
  });
  it('bozuk ad / boş şifre sunucuya hiç gitmez', async () => {
    expect(await m.girisYap('', 'x')).toBe('Kullanıcı adını yaz.');
    expect(await m.girisYap('a b!', 'gizli12')).toBe(m.AD_KURALI);
    expect(await m.girisYap('ali', '')).toBe('Şifreni yaz.');
    expect(S.signIn).toBe(0);
  });
  it('bağlantı yoksa tek istekte durur, net mesaj', async () => {
    S.agHata = true;
    expect(await m.girisYap('ali', 'gizli12')).toMatch(/ulaşılamadı/);
    expect(S.signIn).toBe(1);
  });
});

describe('başka oyuncuların adı (net/kimlik.ts)', async () => {
  const { adDogrulayici, etiket } = await import('../../../src/game/net/kimlik');
  it('yalnız sunucuda karşılığı olan uid ad alır; istemcinin yazdığı ad hiç kullanılmaz', async () => {
    const sor = vi.fn(async (ids: string[]) => new Map(ids.filter(i => i === 'u1').map(i => [i, 'ali'] as [string, string])));
    const k = adDogrulayici(sor);
    k.iste('u1'); k.iste('sahte'); k.iste('');
    expect(k.ad('u1')).toBe('');
    expect(await k.cek()).toBe(true);
    expect(sor).toHaveBeenCalledWith(['u1', 'sahte']);
    expect(k.ad('u1')).toBe('ali'); expect(k.ad('sahte')).toBe('');
    k.iste('u1'); expect(await k.cek()).toBe(false);          // bilinen tekrar sorulmaz
    for (let i = 0; i < 5; i++) { k.iste('sahte'); await k.cek(); }
    expect(sor).toHaveBeenCalledTimes(3);                      // bilinmeyen en çok 3 kez denenir
  });
  it('etiket: karakter adı + @hesap', () => {
    expect(etiket('Ali Usta', 'ali')).toBe('Ali Usta @ali');
    expect(etiket('', '')).toBe('Esnaf');
  });
});
