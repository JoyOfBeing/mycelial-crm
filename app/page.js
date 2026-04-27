'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import Nav from '../components/Nav';
import Link from 'next/link';

const SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'network', label: 'Network', filter: { source: 'network' } },
  { key: 'client-lead', label: 'Clients', filter: { source: 'client-lead' } },
  { key: 'contractor', label: 'Contractors', filter: { source: 'contractor' } },
  { key: 'has-video', label: 'Has Video', filter: { tag: 'has-video' } },
  { key: 'job-curious', label: 'JOB-curious', filter: { tag: 'job-curious' } },
];

const PAGE_SIZE = 50;

function LoginGate() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  return (
    <div className="login-gate">
      <div className="login-card">
        <h1 className="login-title">MycelialCRM</h1>
        <p className="login-sub">Jumpsuit relationship manager</p>
        {sent ? (
          <p className="login-success">Check your email for the login link.</p>
        ) : (
          <form onSubmit={handleLogin}>
            <input
              className="login-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button className="login-btn" disabled={loading}>
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
            {error && <p className="login-error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const { user, loading: authLoading, authorized } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('all');
  const [sortCol, setSortCol] = useState('full_name');
  const [sortAsc, setSortAsc] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async (reset = false) => {
    const start = reset ? 0 : offset;
    let query = supabase
      .from('crm_contacts')
      .select('id, full_name, email, company, sources, tags, last_interaction_at', { count: 'exact' });

    if (search.trim()) {
      query = query.textSearch('search_vector', search.trim(), { type: 'websearch' });
    }

    const seg = SEGMENTS.find(s => s.key === segment);
    if (seg?.filter?.source) {
      query = query.contains('sources', [seg.filter.source]);
    } else if (seg?.filter?.tag) {
      query = query.contains('tags', [seg.filter.tag]);
    }

    query = query.order(sortCol, { ascending: sortAsc, nullsFirst: false });
    query = query.range(start, start + PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) { console.error(error); return; }

    if (reset) {
      setContacts(data || []);
      setOffset(PAGE_SIZE);
    } else {
      setContacts(prev => [...prev, ...(data || [])]);
      setOffset(start + PAGE_SIZE);
    }
    setHasMore((start + PAGE_SIZE) < (count || 0));
    setLoading(false);
  }, [search, segment, sortCol, sortAsc, offset]);

  const fetchCounts = useCallback(async () => {
    const { count: total } = await supabase
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true });

    const results = { all: total || 0 };

    for (const seg of SEGMENTS) {
      if (seg.key === 'all') continue;
      let q = supabase.from('crm_contacts').select('*', { count: 'exact', head: true });
      if (seg.filter.source) q = q.contains('sources', [seg.filter.source]);
      else if (seg.filter.tag) q = q.contains('tags', [seg.filter.tag]);
      const { count: c } = await q;
      results[seg.key] = c || 0;
    }
    setCounts(results);
  }, []);

  useEffect(() => {
    if (!authorized) return;
    setLoading(true);
    fetchContacts(true);
    fetchCounts();
  }, [authorized, search, segment, sortCol, sortAsc]);

  function handleSort(col) {
    if (col === sortCol) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  }

  if (authLoading) {
    return <div className="login-gate"><p className="loading-text">Loading...</p></div>;
  }
  if (!user || !authorized) return <LoginGate />;

  return (
    <>
      <Nav />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Contacts</h1>
        </div>

        <div className="segment-cards">
          {SEGMENTS.map(seg => (
            <div
              key={seg.key}
              className={`segment-card ${segment === seg.key ? 'active' : ''}`}
              onClick={() => setSegment(seg.key)}
            >
              <div className="segment-card-count">{counts[seg.key] ?? '-'}</div>
              <div className="segment-card-label">{seg.label}</div>
            </div>
          ))}
        </div>

        <div className="search-bar">
          <input
            className="search-input"
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="empty-state"><p className="loading-text">Loading contacts...</p></div>
        ) : contacts.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No contacts found</p>
            <p className="empty-state-sub">
              {search ? 'Try a different search term.' : 'Import your first CSV to get started.'}
            </p>
          </div>
        ) : (
          <>
            <table className="contact-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('full_name')}>
                    Name {sortCol === 'full_name' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('email')}>
                    Email {sortCol === 'email' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('company')}>
                    Company {sortCol === 'company' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th>Sources</th>
                  <th onClick={() => handleSort('last_interaction_at')}>
                    Last Interaction {sortCol === 'last_interaction_at' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} onClick={() => window.location.href = `/contacts/${c.id}`}>
                    <td>{c.full_name || '—'}</td>
                    <td>{c.email}</td>
                    <td>{c.company || '—'}</td>
                    <td>
                      {(c.sources || []).map(s => (
                        <span key={s} className={`badge badge-${s}`}>{s}</span>
                      ))}
                    </td>
                    <td>
                      {c.last_interaction_at
                        ? new Date(c.last_interaction_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <button className="load-more-btn" onClick={() => fetchContacts(false)}>
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
