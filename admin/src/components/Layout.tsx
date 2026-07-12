import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';

export default function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/assets/brand/logo-on-dark.svg" alt="Aion Pharma" />
          <span className="brand-sub">CRM</span>
        </div>
        <nav className="nav">
          <NavLink to="/cupons">Cupons</NavLink>
          <NavLink to="/influencers">Influencers</NavLink>
        </nav>
        <div className="sidebar-foot">
          <p className="user-email">{user?.email}</p>
          <button type="button" className="btn-ghost" onClick={() => signOut()}>
            Sair
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
