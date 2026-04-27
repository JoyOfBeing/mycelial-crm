'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';

export default function ReactivationPage() {
  const { user, loading: authLoading, authorized } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [days, setDays] = useState(90);
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authorized) return;
    fetchStale();
  }, [authorized, days, sourceFilter]);

  async function fetchStale() {
    setLoading(true);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let query = supabase
      .from('crm_contacts')
      .select('id, full_name, email, company, sources, tags, last_interaction_at')
      .or(`last_interaction_at.is.null,last_interaction_at.lt.${cutoff.toISOString()}`)
      .order('last_interaction_at', { ascending: true, nullsFirst: true })
      .limit(100);

    if (sourceFilter) {
      query = query.filter('sources', 'cs', `["${sourceFilter}"]`);
    }

    const { data, error } = await query;
    if (error) console.error(error);
    setContacts(data || []);
    setLoading(false);
  }

  async function handleQuickNote(contactId, contactName) {
    const note = prompt(`Quick note for ${contactName}:`);
    if (!note) return;

    await supabase.from('crm_notes').insert({
      contact_id: contactId,
      content: note,
      note_type: 'manual',
    });

    await supabase
      .from('crm_contacts')
      .update({ last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', contactId);

    fetchStale();
  }

  if (authLoading) {
    return <div className="login-gate"><p className="loading-text">Loading...</p></div>;
  }
  if (!user || !authorized) {
    return <div className="login-gate"><p className="loading-text">Not authorized</p></div>;
  }

  function daysSince(date) {
    if (!date) return 'Never';
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return `${diff} days ago`;
  }

  return (
    <>
      <Nav />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Reactivation</h1>
        </div>

        <div className="reactivation-controls">
          <label>Stale after</label>
          <input
            type="number"
            value={days}
            onChange={e => setDays(parseInt(e.target.value) || 90)}
            min={1}
          />
          <label>days</label>
          <select
            className="filter-select"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
          >
            <option value="">All sources</option>
            <option value="network">Network</option>
            <option value="client-lead">Client Leads</option>
            <option value="contractor">Contractor</option>
            <option value="videoask">VideoAsk</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state"><p className="loading-text">Loading...</p></div>
        ) : contacts.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No stale contacts</p>
            <p className="empty-state-sub">Everyone has been contacted within {days} days.</p>
          </div>
        ) : (
          <table className="contact-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Sources</th>
                <th>Last Interaction</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id}>
                  <td
                    style={{ cursor: 'pointer', color: 'var(--blue)' }}
                    onClick={() => window.location.href = `/contacts/${c.id}`}
                  >
                    {c.full_name || '—'}
                  </td>
                  <td>{c.email}</td>
                  <td>{c.company || '—'}</td>
                  <td>
                    {(c.sources || []).map(s => (
                      <span key={s} className={`badge badge-${s}`}>{s}</span>
                    ))}
                  </td>
                  <td>{daysSince(c.last_interaction_at)}</td>
                  <td>
                    <a className="mailto-link" href={`mailto:${c.email}`}>Email</a>
                    {' | '}
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.85rem' }}
                      onClick={() => handleQuickNote(c.id, c.full_name || c.email)}
                    >
                      Add note
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
