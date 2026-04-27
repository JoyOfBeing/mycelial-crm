'use client';

import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const links = [
    { href: '/', label: 'Contacts' },
    { href: '/import', label: 'Import' },
    { href: '/reactivation', label: 'Reactivation' },
  ];

  return (
    <nav className="nav">
      <div className="nav-left">
        <span className="nav-title">JumpsuitCRM</span>
        <div className="nav-links">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link ${pathname === l.href ? 'active' : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <button className="nav-signout" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </nav>
  );
}
