import { createContext, useContext } from 'react';
import type { Sessao, Usuario } from '../lib/sessao';

export type AuthCtx = {
  session: Sessao | null;
  user: Usuario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthCtx | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
