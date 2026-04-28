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

  async function handleMergeContacts() {
    if (selected.size < 2) return;
    const selectedList = contacts.filter(c => selected.has(c.id));
    const primaryName = selectedList.map(c => c.full_name || c.email).join(', ');
    if (!confirm(`Merge ${selected.size} contacts?\n\nThe first selected contact will be kept as primary. Data from the others will be merged in, then the duplicates deleted.\n\nContacts: ${primaryName}`)) return;

    setBulkWorking(true);

    // Fetch full records for all selected
    const fullRecords = [];
    for (const id of selected) {
      const { data } = await supabase.from('crm_contacts').select('*').eq('id', id).single();
      if (data) fullRecords.push(data);
    }

    const primary = fullRecords[0];
    const others = fullRecords.slice(1);

    // Merge fields from others into primary
    const textFields = ['full_name', 'first_name', 'last_name', 'company', 'phone', 'website', 'bio', 'business_size', 'client_notes', 'video_url', 'video_transcript', 'hourly_rate', 'title', 'status'];
    const arrayFields = ['sources', 'tags', 'roles', 'skills', 'interests', 'services_needed', 'specialties'];

    for (const other of others) {
      // Text fields: fill in blanks, prefer longer values for name fields
      for (const f of textFields) {
        if (!primary[f] && other[f]) {
          primary[f] = other[f];
        } else if (other[f] && ['full_name', 'first_name', 'last_name'].includes(f) && (other[f].length > (primary[f] || '').length)) {
          primary[f] = other[f];
        }
      }
      // Array fields: merge unique values
      for (const f of arrayFields) {
        primary[f] = [...new Set([...(primary[f] || []), ...(other[f] || [])])];
      }
      // Numeric
      if (!primary.video_duration && other.video_duration) primary.video_duration = other.video_duration;
      if (!primary.calendly_completed && other.calendly_completed) primary.calendly_completed = other.calendly_completed;
    }

    // Update primary
    const { id, created_at, updated_at, search_vector, email, ...updateFields } = primary;
    await supabase.from('crm_contacts').update({ ...updateFields, updated_at: new Date().toISOString() }).eq('id', primary.id);

    // Move notes from others to primary
    for (const other of others) {
      await supabase.from('crm_notes').update({ contact_id: primary.id }).eq('contact_id', other.id);
    }

    // Delete duplicates
    for (const other of others) {
      await supabase.from('crm_contacts').delete().eq('id', other.id);
    }

    // Add system note
    const mergedEmails = others.map(o => o.email).join(', ');
    await supabase.from('crm_notes').insert({
      contact_id: primary.id,
      content: `Merged with: ${mergedEmails}`,
      note_type: 'system',
    });

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
            {selected.size >= 2 && (
              <button className="bulk-btn bulk-btn-add" onClick={handleMergeContacts} disabled={bulkWorking} style={{ background: 'var(--teal)' }}>
                {bulkWorking ? 'Merging...' : `Merge ${selected.size} contacts`}
              </button>
            )}
            <button className="bulk-btn-clear" onClick={() => setSelected(new Set())}>Clear</button>
            {(() => {
              const selectedContacts = contacts.filter(c => selected.has(c.id));
              const allTags = [...new Set(selectedContacts.flatMap(c => c.tags || []))].sort();
              const allSources = [...new Set(selectedContacts.flatMap(c => c.sources || []))].sort();

              async function bulkRemoveField(field, value) {
                setBulkWorking(true);
                for (const id of selected) {
                  const contact = contacts.find(c => c.id === id);
                  if (!contact) continue;
                  const current = contact[field] || [];
                  if (!current.includes(value)) continue;
                  const updated = current.filter(v => v !== value);
                  await supabase.from('crm_contacts').update({ [field]: updated }).eq('id', id);
                }
                setBulkTag('');
                setSelected(new Set());
                setBulkWorking(false);
                fetchContacts(true);
                fetchCounts();
              }

              if (allTags.length === 0 && allSources.length === 0) return null;
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, width: '100%', alignItems: 'center' }}>
                  {allSources.map(src => (
                    <span key={`src-${src}`} className={`badge badge-${src}`} style={{ cursor: 'default' }}>
                      {src}
                      <button
                        className="tag-remove"
                        disabled={bulkWorking}
                        onClick={() => bulkRemoveField('sources', src)}
                        style={{ marginLeft: 4 }}
                      >×</button>
                    </span>
                  ))}
                  {allTags.map(tag => (
                    <span key={`tag-${tag}`} className="tag">
                      {tag}
                      <button
                        className="tag-remove"
                        disabled={bulkWorking}
                        onClick={() => bulkRemoveField('tags', tag)}
                      >×</button>
                    </span>
                  ))}
                </div>
              );
            })()}
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
