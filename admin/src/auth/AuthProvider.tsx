import { useEffect, useState, type ReactNode } from 'react';
import { entrar, gravarSessao, lerSessao, type Sessao } from '../lib/sessao';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Sessao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(lerSessao());
    setLoading(false);
  }, []);

  async function signIn(email: string, password: string) {
    const s = await entrar(email, password);
    setSession(s);
  }

  async function signOut() {
    gravarSessao(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
