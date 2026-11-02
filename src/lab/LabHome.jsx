import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { AuditPanel, EventLog, SessionInspector, copy, useLabStatus } from './panels.jsx';

export function LabLayout() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="lab">
      <div className="lab-wrap">
        <div className="lab-top">
          <div>
            <p className="eyebrow">Advanced Security Laboratory</p>
            <h1>Security Lab</h1>
          </div>
          <Link to="/" className="lab-back">← Back to the storefront</Link>
        </div>
        <nav className="lab-tabs">
          <NavLink end to="/lab" className={({ isActive }) => `lab-tab ${isActive ? 'active' : ''}`}>Control centre</NavLink>
          <NavLink to="/lab/session" className={({ isActive }) => `lab-tab ${isActive ? 'active' : ''}`}>Labs</NavLink>
          <NavLink to="/lab/evidence" className={({ isActive }) => `lab-tab ${isActive ? 'active' : ''}`}>Evidence &amp; logs</NavLink>
          <NavLink to="/lab/glossary" className={({ isActive }) => `lab-tab ${isActive ? 'active' : ''}`}>Glossary</NavLink>
        </nav>
        <Outlet context={{ copied, setCopied }} />
      </div>
      {copied && <div className="toast-copy">Copied to clipboard</div>}
    </div>
  );
}

function ModeBanner({ status }) {
  if (!status) return null;
  if (status.publicDemo) {
    return <div className="lab-banner secure"><span><b>Public preview.</b> This deployment is locked to <span className="lab-mode-badge secure">secure</span> mode. The vulnerable exercises and lab controls run only on a local install.</span></div>;
  }
  return (
    <div className={`lab-banner ${status.mode}`}>
      <span><b>Current mode:</b> <span className={`lab-mode-badge ${status.mode}`}>{status.mode.toUpperCase()}</span></span>
      <span style={{ color: 'var(--lab-muted)', fontSize: 13 }}>Switching modes clears all sessions and signs everyone out.</span>
    </div>
  );
}

export function LabHome() {
  const [status, refresh] = useLabStatus();
  const { refreshAuth } = useApp();
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);

  const act = async (label, fn) => {
    setBusy(label);
    try { await fn(); await refresh(); await refreshAuth(); } catch { /* ignore */ }
    setBusy('');
  };

  const setMode = (mode) => act('mode', () => api('/api/lab/mode', { method: 'POST', body: { mode } }));
  const reset = () => { if (confirm('Reset the lab? This restores the fabricated data and clears all sessions, events and evidence.')) act('reset', () => api('/api/lab/reset', { method: 'POST' })); };
  const clearSessions = () => act('sessions', () => api('/api/lab/clear-sessions', { method: 'POST' }));
  const clearEvents = () => { if (confirm('Clear all events and captured requests?')) act('events', () => api('/api/lab/events/clear', { method: 'POST' })); };
  const toggleExpiry = (on) => act('expiry', () => api('/api/lab/settings', { method: 'POST', body: { shortExpiry: on } }));

  if (!status) return <p style={{ color: 'var(--lab-muted)' }}>Loading the control centre…</p>;
  const locked = status.publicDemo;

  return (
    <div>
      <ModeBanner status={status} />

      <div className="lab-grid">
        <div className="lab-panel">
          <h2>Mode</h2>
          <div className="mode-switch" role="group" aria-label="Lab mode">
            <button type="button" className={`vuln ${status.mode === 'vulnerable' ? 'on' : ''}`} disabled={locked || busy} onClick={() => setMode('vulnerable')}>Vulnerable</button>
            <button type="button" className={`sec ${status.mode === 'secure' ? 'on' : ''}`} disabled={locked || busy} onClick={() => setMode('secure')}>Secure</button>
          </div>
          <p style={{ color: 'var(--lab-muted)', fontSize: 13, marginTop: 14 }}>
            Both modes share one storefront, so you can compare the same action in each. The session cookie is reissued on every switch.
          </p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 13, opacity: locked ? .5 : 1 }}>
            <input type="checkbox" disabled={locked} checked={status.shortExpiry} onChange={(e) => toggleExpiry(e.target.checked)} />
            Short expiry demo (secure idle timeout → 60s)
          </label>
        </div>

        <div className="lab-panel">
          <h2>Reset &amp; cleanup</h2>
          <div className="lab-btn-row">
            <button type="button" className="lab-btn danger" disabled={locked || busy} onClick={reset}>Reset lab</button>
            <button type="button" className="lab-btn" disabled={locked || busy} onClick={clearSessions}>Clear sessions</button>
            <button type="button" className="lab-btn" disabled={locked || busy} onClick={clearEvents}>Clear events</button>
          </div>
          <dl className="kv" style={{ marginTop: 16 }}>
            <dt>Active sessions</dt><dd>{status.counts.sessions}</dd>
            <dt>Logged events</dt><dd>{status.counts.events}</dd>
            <dt>Saved evidence</dt><dd>{status.counts.evidence}</dd>
          </dl>
        </div>

        <div className="lab-panel">
          <h2>Test accounts</h2>
          {locked ? <p style={{ color: 'var(--lab-muted)', fontSize: 13 }}>Use <code>student@lab.local</code> / <code>LabStudent123!</code>.</p> : (
            <div className="acct-list">
              {status.accounts.map((a) => (
                <div key={a.email} className="acct">
                  <span><code>{a.email}</code> · <code>{a.password}</code></span>
                  <span style={{ color: 'var(--lab-muted)' }}>{a.role}
                    <button type="button" onClick={() => copy(`${a.email}`, setCopied)} title="Copy email">⧉</button>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p style={{ color: 'var(--lab-muted)', fontSize: 12, marginTop: 12 }}>Fabricated accounts for local training only.</p>
        </div>

        <div className="lab-panel">
          <h2>Progress</h2>
          <div className="progress-ring">
            <strong style={{ fontSize: 24, color: 'var(--lab-gold)' }}>{status.progress.done}/{status.progress.total}</strong>
            <div className="progress-bar"><div style={{ width: `${(status.progress.done / status.progress.total) * 100}%` }} /></div>
          </div>
          <p style={{ color: 'var(--lab-muted)', fontSize: 13, marginTop: 12 }}>Challenges complete themselves when the matching event is detected. Open each lab for step-by-step instructions.</p>
        </div>
      </div>

      <h2 style={{ color: '#fff', fontFamily: 'var(--sans)', fontSize: 16, letterSpacing: '.04em', textTransform: 'uppercase', margin: '30px 0 4px' }}>The laboratories</h2>
      <div className="lab-index">
        {status.progress.labs.map((lab) => {
          const done = lab.challenges.filter((c) => c.done).length;
          const complete = done === lab.challenges.length;
          return (
            <Link key={lab.id} to={`/lab/${lab.id}`} className={`lab-card ${complete ? 'complete' : ''}`}>
              {complete && <span className="star">✓ complete</span>}
              <span className="lab-num">0{lab.challenges && status.progress.labs.indexOf(lab) + 1}</span>
              <h3>{lab.title}</h3>
              <div className="lab-prog">
                <div className="progress-bar" style={{ maxWidth: 120 }}><div style={{ width: `${(done / lab.challenges.length) * 100}%` }} /></div>
                {done}/{lab.challenges.length}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="lab-grid" style={{ marginTop: 30 }}>
        <div className="lab-panel"><h2>This browser's session</h2><SessionInspector /></div>
        <div className="lab-panel"><h2>Live configuration audit</h2><p style={{ color: 'var(--lab-muted)', fontSize: 13, marginBottom: 12 }}>Full audit in <Link to="/lab/audit">Lab 7</Link>.</p><AuditLite /></div>
      </div>

      <div className="lab-panel span2" style={{ marginTop: 18 }}>
        <h2>Recent events</h2>
        <EventLog compact />
        <p style={{ marginTop: 10 }}><Link to="/lab/evidence">Open the full event log and evidence export →</Link></p>
      </div>
    </div>
  );
}

function AuditLite() {
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); try { const d = await api('/api/lab/audit/run', { method: 'POST' }); setR(d.results); } catch { /* */ } setBusy(false); };
  return (
    <div>
      <button type="button" className="lab-btn primary" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run quick audit'}</button>
      {r && (
        <dl className="kv" style={{ marginTop: 14 }}>
          {Object.entries(r).map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{k}</dt><dd><span className={`chip-flag ${v.pass ? 'on' : 'off'}`}>{v.pass ? 'pass' : 'fail'}</span></dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function LabEvidence() {
  const [busy, setBusy] = useState(false);

  const exportJson = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/lab/export', { credentials: 'same-origin' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `halden-voss-evidence-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setBusy(false);
  };

  return (
    <div>
      <div className="lab-panel span2" style={{ marginBottom: 18 }}>
        <h2>Evidence export</h2>
        <p style={{ color: 'var(--lab-muted)', fontSize: 13.5, marginBottom: 14 }}>
          Download the full event log, captured requests and saved notes as one JSON file. Passwords, cookies and tokens are redacted, and the file carries a SHA-256 integrity digest for your chain-of-custody record.
        </p>
        <button type="button" className="lab-btn primary" onClick={exportJson} disabled={busy}>{busy ? 'Preparing…' : 'Export evidence (JSON)'}</button>
      </div>
      <div className="lab-panel span2">
        <h2>Event timeline</h2>
        <EventLog />
      </div>
    </div>
  );
}

export function LabGlossary() {
  const [glossary, setGlossary] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { api('/api/lab/curriculum').then((d) => setGlossary(d.glossary)).catch(() => {}); }, []);
  const filtered = glossary.filter(([term, def]) => (term + def).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="lab-panel span2">
      <h2>Glossary</h2>
      <div className="lab-filter"><input placeholder="Filter terms…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} /></div>
      <dl>
        {filtered.map(([term, def]) => (
          <div key={term} className="glossary-item"><dt>{term}</dt><dd>{def}</dd></div>
        ))}
      </dl>
    </div>
  );
}
