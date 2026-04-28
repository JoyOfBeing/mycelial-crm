'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';
import Nav from '../../../components/Nav';
import Link from 'next/link';

export default function ContactProfilePage() {
  const { id } = useParams();
  const { user, loading: authLoading, authorized } = useAuth();
  const [contact, setContact] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authorized || !id) return;
    fetchContact();
    fetchNotes();
  }, [authorized, id]);

  async function fetchContact() {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) console.error(error);
    setContact(data);
    setLoading(false);
  }

  async function fetchNotes() {
    const { data } = await supabase
      .from('crm_notes')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false });
    setNotes(data || []);
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSaving(true);

    await supabase.from('crm_notes').insert({
      contact_id: id,
      content: newNote.trim(),
      note_type: 'manual',
    });

    await supabase
      .from('crm_contacts')
      .update({ last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);

    setNewNote('');
    setSaving(false);
    fetchNotes();
    fetchContact();
  }

  async function handleAddTag(tag) {
    if (!contact || !tag.trim()) return;
    const newTags = [...new Set([...(contact.tags || []), tag.trim().toLowerCase()])];
    await supabase.from('crm_contacts').update({ tags: newTags }).eq('id', id);
    fetchContact();
  }

  async function handleRemoveTag(tag) {
    if (!contact) return;
    const newTags = (contact.tags || []).filter(t => t !== tag);
    await supabase.from('crm_contacts').update({ tags: newTags }).eq('id', id);
    fetchContact();
  }

  if (authLoading) {
    return <div className="login-gate"><p className="loading-text">Loading...</p></div>;
  }
  if (!user || !authorized) {
    return <div className="login-gate"><p className="loading-text">Not authorized</p></div>;
  }

  if (loading) {
    return (
      <>
        <Nav />
        <div className="page"><p className="loading-text">Loading contact...</p></div>
      </>
    );
  }

  if (!contact) {
    return (
      <>
        <Nav />
        <div className="page">
          <Link href="/" className="profile-back">← Back to contacts</Link>
          <div className="empty-state">
            <p className="empty-state-title">Contact not found</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="page">
        <Link href="/" className="profile-back">← Back to contacts</Link>

        <div className="profile-header">
          <div>
            <h1 className="profile-name">{contact.full_name || contact.email}</h1>
            <p className="profile-email">{contact.email}</p>
            <div className="profile-meta">
              {contact.company && <span>{contact.company}</span>}
              {contact.phone && <span>{contact.phone}</span>}
              {contact.website && (
                <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer">
                  Website
                </a>
              )}
              <a href={`mailto:${contact.email}`}>Send email</a>
            </div>
            {(contact.title || contact.hourly_rate || contact.status) && (
              <div style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--text-light)' }}>
                {contact.title && <span>{contact.title}</span>}
                {contact.title && contact.hourly_rate && <span> · </span>}
                {contact.hourly_rate && <span>{contact.hourly_rate}</span>}
                {contact.status && (
                  <span style={{ marginLeft: contact.title || contact.hourly_rate ? 12 : 0, padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: contact.status === 'active' ? 'var(--teal)' : contact.status === 'do not use' ? 'var(--rust)' : '#666', color: '#fff' }}>
                    {contact.status}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Source badges */}
        <div style={{ marginBottom: 16 }}>
          {(contact.sources || []).map(s => (
            <span key={s} className={`badge badge-${s}`}>{s}</span>
          ))}
        </div>

        {/* Tags */}
        <div className="profile-section">
          <h3 className="profile-section-title">Tags</h3>
          <div>
            {(contact.tags || []).map(t => (
              <span key={t} className="tag">
                {t}
                <button className="tag-remove" onClick={() => handleRemoveTag(t)}>×</button>
              </span>
            ))}
            <button
              className="tag"
              style={{ cursor: 'pointer', borderStyle: 'dashed' }}
              onClick={() => {
                const tag = prompt('Enter tag name:');
                if (tag) handleAddTag(tag);
              }}
            >
              + add tag
            </button>
          </div>
        </div>

        {/* Roles / Skills / Interests (Network data) */}
        {((contact.roles?.length > 0) || (contact.skills?.length > 0) || (contact.interests?.length > 0) || (contact.specialties?.length > 0)) && (
          <div className="profile-section">
            <h3 className="profile-section-title">Profile</h3>
            {contact.roles?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Roles</div>
                <div className="profile-list">
                  {contact.roles.map(r => <span key={r} className="profile-list-item">{r}</span>)}
                </div>
              </div>
            )}
            {contact.skills?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Skills</div>
                <div className="profile-list">
                  {contact.skills.map(s => <span key={s} className="profile-list-item">{s}</span>)}
                </div>
              </div>
            )}
            {contact.interests?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Interests</div>
                <div className="profile-list">
                  {contact.interests.map(i => <span key={i} className="profile-list-item">{i}</span>)}
                </div>
              </div>
            )}
            {contact.specialties?.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Specialties</div>
                <div className="profile-list">
                  {contact.specialties.map(s => <span key={s} className="profile-list-item">{s}</span>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bio */}
        {contact.bio && (
          <div className="profile-section">
            <h3 className="profile-section-title">Bio</h3>
            <p className="profile-bio">{contact.bio}</p>
          </div>
        )}

        {/* Client Lead data */}
        {(contact.services_needed?.length > 0 || contact.business_size || contact.client_notes) && (
          <div className="profile-section">
            <h3 className="profile-section-title">Client Info</h3>
            {contact.services_needed?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Services Needed</div>
                <div className="profile-list">
                  {contact.services_needed.map(s => <span key={s} className="profile-list-item">{s}</span>)}
                </div>
              </div>
            )}
            {contact.business_size && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Business Size</div>
                <p>{contact.business_size}</p>
              </div>
            )}
            {contact.client_notes && (
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Notes from Form</div>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{contact.client_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* VideoAsk data */}
        {(contact.video_url || contact.video_transcript) && (
          <div className="profile-section">
            <h3 className="profile-section-title">VideoAsk</h3>
            {contact.video_url && (
              <p style={{ marginBottom: 12 }}>
                <a href={contact.video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>
                  Watch video
                </a>
                {contact.video_duration && (
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginLeft: 8 }}>
                    ({Math.round(contact.video_duration)}s)
                  </span>
                )}
              </p>
            )}
            {contact.video_transcript && (
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Transcript</div>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{contact.video_transcript}</p>
              </div>
            )}
          </div>
        )}

        {/* Notes Timeline */}
        <div className="profile-section">
          <h3 className="profile-section-title">Notes</h3>
          <form className="note-form" onSubmit={handleAddNote}>
            <textarea
              className="note-input"
              placeholder="Add a note..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              rows={2}
            />
            <button className="note-submit" disabled={saving || !newNote.trim()}>
              {saving ? 'Saving...' : 'Add'}
            </button>
          </form>
          {notes.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', fontStyle: 'italic' }}>No notes yet.</p>
          ) : (
            notes.map(n => (
              <div key={n.id} className="note-item">
                <p className="note-content">{n.content}</p>
                <div className="note-meta">
                  <span className="note-type">{n.note_type}</span>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
