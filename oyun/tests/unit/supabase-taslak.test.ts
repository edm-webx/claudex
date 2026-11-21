// PRF-11: giriş için kullanılan yüzey: istemci kurulur, auth/from/rpc/channel var, taslaklar yalnız çağrılınca hata verir.
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('supabase istemcisi (taslaklı paket)', () => {
  const c = createClient('https://x.supabase.co', 'anon', { auth: { persistSession: false, autoRefreshToken: false } });
  it('kullanılan yüzey çalışır', () => {
    expect(typeof c.auth.signUp).toBe('function');
    expect(typeof c.auth.signInWithPassword).toBe('function');
    expect(typeof c.from('t').select).toBe('function');
    expect(typeof c.rpc).toBe('function');
    expect(typeof c.channel('k').subscribe).toBe('function');
    c.removeAllChannels();
  });
});
