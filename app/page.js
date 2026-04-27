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
  { key: 'investors', label: 'Investors', filter: { source: 'investors' } },
  { key: 'has-video', label: 'Has Video', filter: { tag: 'has-video' } },
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
        <h1 className="login-title">JumpsuitCRM</h1>
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
  const [selected, setSelected] = useState(new Set());
  const [bulkTag, setBulkTag] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);

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
      query = query.filter('sources', 'cs', `["${seg.filter.source}"]`);
    } else if (seg?.filter?.tag) {
      query = query.filter('tags', 'cs', `["${seg.filter.tag}"]`);
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
    const { count: total, error: totalErr } = await supabase
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true });

    if (totalErr) console.error('Count error:', totalErr);
    const results = { all: total || 0 };

    for (const seg of SEGMENTS) {
      if (seg.key === 'all') continue;
      let q = supabase.from('crm_contacts').select('*', { count: 'exact', head: true });
      if (seg.filter.source) q = q.filter('sources', 'cs', `["${seg.filter.source}"]`);
      else if (seg.filter.tag) q = q.filter('tags', 'cs', `["${seg.filter.tag}"]`);
      const { count: c, error: segErr } = await q;
      if (segErr) console.error(`Segment ${seg.key} error:`, segErr);
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

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map(c => c.id)));
  }

  async function handleBulkAddTag() {
    if (!bulkTag.trim() || selected.size === 0) return;
    setBulkWorking(true);
    const tag = bulkTag.trim().toLowerCase();

    for (const id of selected) {
      const contact = contacts.find(c => c.id === id);
      if (!contact) continue;
      const newTags = [...new Set([...(contact.tags || []), tag])];
      await supabase.from('crm_contacts').update({ tags: newTags }).eq('id', id);
    }

    setBulkTag('');
    setSelected(new Set());
    setBulkWorking(false);
    fetchContacts(true);
    fetchCounts();
  }

  async function handleBulkRemoveTag() {
    if (!bulkTag.trim() || selected.size === 0) return;
    setBulkWorking(true);
    const tag = bulkTag.trim().toLowerCase();

    for (const id of selected) {
      const contact = contacts.find(c => c.id === id);
      if (!contact) continue;
      const newTags = (contact.tags || []).filter(t => t !== tag);
      await supabase.from('crm_contacts').update({ tags: newTags }).eq('id', id);
    }

    setBulkTag('');
    setSelected(new Set());
    setBulkWorking(false);
    fetchContacts(true);
    fetchCounts();
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

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span className="bulk-count">{selected.size} selected</span>
            <input
              className="bulk-tag-input"
              type="text"
              placeholder="Tag name..."
              value={bulkTag}
              onChange={e => setBulkTag(e.target.value)}
            />
            <button className="bulk-btn bulk-btn-add" onClick={handleBulkAddTag} disabled={bulkWorking || !bulkTag.trim()}>
              {bulkWorking ? 'Working...' : '+ Add tag'}
            </button>
            <button className="bulk-btn bulk-btn-remove" onClick={handleBulkRemoveTag} disabled={bulkWorking || !bulkTag.trim()}>
              − Remove tag
            </button>
            <button className="bulk-btn-clear" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

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
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={contacts.length > 0 && selected.size === contacts.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
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
                  <tr key={c.id}>
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                      />
                    </td>
                    <td onClick={() => window.location.href = `/contacts/${c.id}`} style={{ cursor: 'pointer' }}>{c.full_name || '—'}</td>
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
