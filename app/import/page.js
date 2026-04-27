'use client';

import { useState, useRef } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import Papa from 'papaparse';

const SOURCE_TYPES = [
  { value: 'network', label: 'Typeform — Network' },
  { value: 'client-lead', label: 'Typeform — Client Leads' },
  { value: 'mixed', label: 'Typeform — Mixed/Other' },
  { value: 'contractor', label: 'Contractor List' },
  { value: 'videoask', label: 'VideoAsk — Intros' },
  { value: 'wix', label: 'Wix CRM' },
];

const CRM_FIELDS = [
  { value: '', label: '— skip —' },
  { value: 'email', label: 'Email' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'full_name', label: 'Full Name' },
  { value: 'company', label: 'Company' },
  { value: 'phone', label: 'Phone' },
  { value: 'website', label: 'Website' },
  { value: 'bio', label: 'Bio' },
  { value: 'roles', label: 'Roles (comma-separated)' },
  { value: 'skills', label: 'Skills (comma-separated)' },
  { value: 'interests', label: 'Interests (comma-separated)' },
  { value: 'services_needed', label: 'Services Needed (comma-separated)' },
  { value: 'business_size', label: 'Business Size' },
  { value: 'client_notes', label: 'Client Notes' },
  { value: 'video_url', label: 'Video URL' },
  { value: 'video_transcript', label: 'Video Transcript' },
  { value: 'video_duration', label: 'Video Duration' },
  { value: 'calendly_completed', label: 'Calendly Completed' },
];

// Auto-map column names to CRM fields based on source type
function getAutoMapping(headers, sourceType) {
  const mapping = {};
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  const presets = {
    network: {
      email: ['email', 'email address'],
      first_name: ['first name', 'first_name', 'firstname'],
      last_name: ['last name', 'last_name', 'lastname'],
      full_name: ['name', 'full name', 'full_name'],
      company: ['company', 'organization', 'company name'],
      phone: ['phone', 'phone number'],
      website: ['website', 'portfolio', 'url', 'portfolio url'],
      bio: ['bio', 'about', 'tell us about yourself', 'about yourself'],
      roles: ['role', 'roles', 'identity', 'what best describes you', 'i identify as'],
      skills: ['skills', 'skill', 'expertise', 'what do you do'],
      interests: ['interests', 'interest', 'what interests you', 'what are you interested in'],
    },
    'client-lead': {
      email: ['email', 'email address'],
      first_name: ['first name', 'first_name'],
      last_name: ['last name', 'last_name'],
      full_name: ['name', 'full name'],
      company: ['company', 'business name', 'company name'],
      phone: ['phone', 'phone number'],
      services_needed: ['services', 'services needed', 'what services', 'what do you need'],
      business_size: ['business size', 'company size', 'size', 'team size'],
      client_notes: ['notes', 'additional notes', 'anything else', 'message'],
    },
    mixed: {
      email: ['email', 'email address'],
      first_name: ['first name', 'first_name', 'firstname'],
      last_name: ['last name', 'last_name', 'lastname'],
      full_name: ['name', 'full name', 'full_name'],
      company: ['company', 'organization', 'company name'],
      phone: ['phone', 'phone number'],
    },
    contractor: {
      email: ['email', 'email address'],
      first_name: ['first name', 'first_name', 'firstname'],
      last_name: ['last name', 'last_name', 'lastname'],
      full_name: ['name', 'full name'],
    },
    videoask: {
      email: ['email', 'email address', 'respondent email'],
      first_name: ['first name', 'first_name', 'name'],
      full_name: ['name', 'full name', 'respondent name'],
      video_url: ['video url', 'video', 'media url', 'response url'],
      video_transcript: ['transcript', 'transcription', 'response transcript'],
      video_duration: ['duration', 'video duration', 'length'],
      calendly_completed: ['calendly', 'calendly completed', 'booked', 'scheduled'],
    },
    wix: {
      email: ['email', 'email address'],
      first_name: ['first name', 'first_name'],
      last_name: ['last name', 'last_name'],
      full_name: ['name', 'full name'],
      company: ['company', 'company name'],
      phone: ['phone', 'phone number'],
    },
  };

  const preset = presets[sourceType] || presets.mixed;

  headers.forEach((header, i) => {
    const lower = lowerHeaders[i];
    let matched = false;
    for (const [field, patterns] of Object.entries(preset)) {
      if (patterns.some(p => lower.includes(p) || p.includes(lower))) {
        mapping[header] = field;
        matched = true;
        break;
      }
    }
    if (!matched) mapping[header] = '';
  });

  return mapping;
}

function getAutoTags(sourceType) {
  const tagMap = {
    network: ['network'],
    'client-lead': ['client-lead'],
    contractor: ['contractor'],
    videoask: ['has-video'],
    mixed: ['mixed'],
    wix: ['wix'],
  };
  return tagMap[sourceType] || [];
}

function parseListField(value) {
  if (!value) return [];
  return value.split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

function parseBool(value) {
  if (!value) return false;
  const v = String(value).toLowerCase().trim();
  return ['true', 'yes', '1', 'completed', 'booked'].includes(v);
}

function buildContact(row, mapping, sourceType) {
  const contact = {};
  let email = null;

  for (const [csvCol, crmField] of Object.entries(mapping)) {
    if (!crmField || !row[csvCol]) continue;
    const val = String(row[csvCol]).trim();
    if (!val) continue;

    if (crmField === 'email') {
      email = val.toLowerCase();
      contact.email = email;
    } else if (['roles', 'skills', 'interests', 'services_needed'].includes(crmField)) {
      contact[crmField] = parseListField(val);
    } else if (crmField === 'video_duration') {
      contact[crmField] = parseFloat(val) || null;
    } else if (crmField === 'calendly_completed') {
      contact[crmField] = parseBool(val);
    } else {
      contact[crmField] = val;
    }
  }

  if (!email) return null;

  // Build full_name if not set
  if (!contact.full_name && (contact.first_name || contact.last_name)) {
    contact.full_name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
  }

  contact.sources = [sourceType];
  contact.tags = [...getAutoTags(sourceType)];

  // Add role tags for network source
  if (sourceType === 'network' && contact.roles) {
    contact.roles.forEach(r => {
      const tag = r.toLowerCase().replace(/\s+/g, '-');
      if (!contact.tags.includes(tag)) contact.tags.push(tag);
    });
  }

  // Add calendly tag for videoask
  if (sourceType === 'videoask' && contact.calendly_completed) {
    contact.tags.push('onboarded');
  }

  return contact;
}

export default function ImportPage() {
  const { user, loading: authLoading, authorized } = useAuth();
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState('network');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const hdrs = results.meta.fields || [];
        setHeaders(hdrs);
        setRows(results.data);
        setMapping(getAutoMapping(hdrs, sourceType));
        setStep(2);
      },
      error: (err) => {
        alert('Error parsing CSV: ' + err.message);
      },
    });
  }

  async function handlePreview() {
    // Check which emails already exist
    const previewRows = rows.slice(0, 10);
    const contacts = previewRows.map(r => buildContact(r, mapping, sourceType));

    const emails = contacts.filter(Boolean).map(c => c.email);
    const { data: existing } = await supabase
      .from('crm_contacts')
      .select('email')
      .in('email', emails);

    const existingEmails = new Set((existing || []).map(e => e.email));

    const previews = contacts.map((c, i) => {
      if (!c) return { row: previewRows[i], status: 'skip', reason: 'No email' };
      if (existingEmails.has(c.email)) return { row: previewRows[i], contact: c, status: 'merge' };
      return { row: previewRows[i], contact: c, status: 'new' };
    });

    setPreview(previews);
    setStep(3);
  }

  async function handleImport() {
    setImporting(true);
    let imported = 0, merged = 0, skipped = 0;
    const batchSize = 50;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const contacts = batch.map(r => buildContact(r, mapping, sourceType)).filter(Boolean);

      for (const contact of contacts) {
        // Check if contact exists
        const { data: existing } = await supabase
          .from('crm_contacts')
          .select('id, sources, tags, roles, skills, interests, services_needed')
          .eq('email', contact.email)
          .single();

        if (existing) {
          // Merge: update non-null fields, append arrays
          const updates = {};
          for (const [key, val] of Object.entries(contact)) {
            if (key === 'email' || key === 'sources' || key === 'tags') continue;
            if (['roles', 'skills', 'interests', 'services_needed'].includes(key)) {
              const existingArr = existing[key] || [];
              const newArr = [...new Set([...existingArr, ...val])];
              if (newArr.length > existingArr.length) updates[key] = newArr;
            } else if (val && val !== '') {
              updates[key] = val;
            }
          }

          // Merge sources and tags
          const newSources = [...new Set([...(existing.sources || []), ...contact.sources])];
          const newTags = [...new Set([...(existing.tags || []), ...contact.tags])];
          updates.sources = newSources;
          updates.tags = newTags;
          updates.updated_at = new Date().toISOString();

          await supabase.from('crm_contacts').update(updates).eq('id', existing.id);

          // Add system note
          await supabase.from('crm_notes').insert({
            contact_id: existing.id,
            content: `Merged data from ${sourceType} import`,
            note_type: 'system',
          });

          merged++;
        } else {
          // Insert new contact
          contact.updated_at = new Date().toISOString();
          const { error } = await supabase.from('crm_contacts').insert(contact);
          if (error) { skipped++; console.error('Insert error:', error); }
          else imported++;
        }
      }

      skipped += batch.length - contacts.length;
    }

    // Log the import
    await supabase.from('crm_import_log').insert({
      source_name: sourceType,
      file_name: fileName,
      rows_total: rows.length,
      rows_imported: imported,
      rows_merged: merged,
      rows_skipped: skipped,
    });

    setResult({ imported, merged, skipped, total: rows.length });
    setImporting(false);
    setStep(4);
  }

  function reset() {
    setStep(1);
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPreview([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  if (authLoading) {
    return <div className="login-gate"><p className="loading-text">Loading...</p></div>;
  }
  if (!user || !authorized) {
    return <div className="login-gate"><p className="loading-text">Not authorized</p></div>;
  }

  const stepLabels = ['Source', 'Map Columns', 'Preview', 'Done'];

  return (
    <>
      <Nav />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Import Contacts</h1>
        </div>

        <div className="import-steps">
          {stepLabels.map((label, i) => (
            <div key={i} className={`import-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
              <span className="import-step-num">{step > i + 1 ? '✓' : i + 1}</span>
              {label}
            </div>
          ))}
        </div>

        {/* Step 1: Choose source + upload */}
        {step === 1 && (
          <div className="import-card">
            <label className="import-label">Source Type</label>
            <select
              className="filter-select"
              value={sourceType}
              onChange={e => setSourceType(e.target.value)}
              style={{ width: '100%', marginBottom: 20 }}
            >
              {SOURCE_TYPES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <label className="import-label">Upload CSV</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="import-file-input"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* Step 2: Map columns */}
        {step === 2 && (
          <div className="import-card">
            <p style={{ marginBottom: 16, color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              {rows.length} rows found in <strong>{fileName}</strong>. Map CSV columns to CRM fields:
            </p>

            {headers.map(h => (
              <div key={h} className="mapping-row">
                <span className="mapping-csv-col">{h}</span>
                <span className="mapping-arrow">→</span>
                <select
                  className="mapping-select"
                  value={mapping[h] || ''}
                  onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value }))}
                >
                  {CRM_FIELDS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            ))}

            <div style={{ marginTop: 20 }}>
              <button className="import-btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="import-btn" onClick={handlePreview}>Preview Import</button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div className="import-card" style={{ maxWidth: '100%' }}>
            <p style={{ marginBottom: 16, color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              Preview (first 10 rows of {rows.length} total):
            </p>

            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Company</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className={`row-${p.status}`}>
                    <td>
                      {p.status === 'new' && '🟢 New'}
                      {p.status === 'merge' && '🟡 Merge'}
                      {p.status === 'skip' && '🔴 Skip'}
                    </td>
                    <td>{p.contact?.email || '—'}</td>
                    <td>{p.contact?.full_name || p.contact?.first_name || '—'}</td>
                    <td>{p.contact?.company || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 20 }}>
              <button className="import-btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button className="import-btn" onClick={handleImport} disabled={importing}>
                {importing ? 'Importing...' : `Import ${rows.length} rows`}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && result && (
          <div className="import-card">
            <div className="import-result">
              <strong>Import complete!</strong>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>{result.imported} new contacts created</li>
                <li>{result.merged} existing contacts merged</li>
                <li>{result.skipped} rows skipped (no email or errors)</li>
              </ul>
            </div>
            <button className="import-btn" onClick={reset} style={{ marginTop: 16 }}>
              Import another file
            </button>
          </div>
        )}
      </div>
    </>
  );
}
