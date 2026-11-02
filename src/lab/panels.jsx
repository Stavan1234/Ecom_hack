import { useEffect, useState } from 'react';
import { api, clockTime } from '../api.js';

export function useLabStatus() {
  const [status, setStatus] = useState(null);
  const refresh = () => api('/api/lab/status').then(setStatus).catch(() => {});
  useEffect(() => { refresh(); }, []);
  return [status, refresh];
}

export function copy(text, setCopied) {
  navigator.clipboard?.writeText(text).then(() => {
    setCopied?.(true);
    setTimeout(() => setCopied?.(false), 1400);
  }).catch(() => {});
}

export function EventLog({ compact = false, lab = null }) {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState({ q: '', category: '', result: '' });
  const [open, setOpen] = useState(null);

  const load = () => {
    const q = new URLSearchParams();
    if (filter.q) q.set('q', filter.q);
    if (filter.category) q.set('category', filter.category);
    if (filter.result) q.set('result', filter.result);
    q.set('limit', compact ? '40' : '250');
    api(`/api/lab/events?${q}`).then((d) => setEvents(d.events)).catch(() => {});
  };
  useEffect(load, [filter.q, filter.category, filter.result]);

  return (
    <div>
      {!compact && (
        <div className="lab-filter">
          <input placeholder="Search endpoint, action, origin…" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          <select value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
            <option value="">All categories</option><option value="security">Security</option><option value="app">Application</option>
          </select>
          <select value={filter.result} onChange={(e) => setFilter({ ...filter, result: e.target.value })}>
            <option value="">All results</option><option value="success">Success</option><option value="failure">Failure</option><option value="blocked">Blocked</option>
          </select>
          <button type="button" className="lab-btn" onClick={load}>Refresh</button>
        </div>
      )}
      <div className="event-scroll">
        <table className="event-table">
          <thead><tr><th>Time</th><th>Method</th><th>Endpoint</th><th>Event</th><th>Result</th></tr></thead>
          <tbody>
            {events.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--lab-muted)', padding: 16 }}>No events yet.</td></tr>}
            {events.map((e) => (
              <tr key={e.id} className="ev-expand" onClick={() => setOpen(open === e.id ? null : e.id)}>
                <td className="lab-mono">{clockTime(e.ts)}</td>
                <td className="lab-mono">{e.method}</td>
                <td className="lab-mono">{e.endpoint}</td>
                <td>{e.security_event ? <span className="ev-tag">{e.security_event}</span> : <span style={{ color: 'var(--lab-muted)' }}>{e.action}</span>}
                  {open === e.id && <div className="ev-details">{JSON.stringify(e.details, null, 2)}{'\n'}request_id: {e.request_id} · origin: {e.origin} · mode: {e.mode}</div>}
                </td>
                <td><span className={`ev-result ${e.result}`}>{e.result}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SessionInspector() {
  const [data, setData] = useState(null);
  const refresh = () => api('/api/lab/session-inspect').then(setData).catch(() => {});
  useEffect(() => { refresh(); }, []);
  if (!data) return <p style={{ color: 'var(--lab-muted)' }}>Loading…</p>;

  return (
    <div>
      <dl className="kv">
        <dt>This browser</dt><dd>{data.authenticated ? <span className="chip-flag on">signed in as {data.user.email}</span> : <span className="chip-flag off">not signed in</span>}</dd>
        <dt>Cookie received</dt><dd>{data.cookieHeaderReceived ? 'yes' : 'no'}</dd>
        <dt>Cookie attributes</dt><dd className="lab-mono">{data.cookieAttributes.join('; ')}</dd>
        {data.current && <>
          <dt>Token</dt><dd className="lab-mono">{data.current.tokenFingerprint}</dd>
          <dt>Issued to</dt><dd>{data.current.issuedTo}</dd>
          <dt>Idle expires</dt><dd className="lab-mono">{clockTime(data.current.idleExpiresAt)}</dd>
          <dt>Logged out</dt><dd>{data.current.loggedOutAt ? <span className="chip-flag off">yes, still accepted</span> : 'no'}</dd>
          <dt>Rotations</dt><dd>{data.current.rotations}</dd>
        </>}
      </dl>
      <div className="lab-btn-row" style={{ marginTop: 14 }}>
        <button type="button" className="lab-btn" onClick={refresh}>Refresh</button>
        <button type="button" className="lab-btn" onClick={() => api('/api/lab/client-event', { method: 'POST', body: { type: 'httponly-check', visible: /lab_session/.test(document.cookie) } }).then(refresh)}>Read document.cookie</button>
      </div>
      <p className="audit-evidence" style={{ marginTop: 10 }}>document.cookie sees: {/lab_session/.test(document.cookie) ? 'lab_session is visible to JavaScript' : 'lab_session is hidden from JavaScript'}</p>
      {data.sessions.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, margin: '16px 0 8px', color: '#fff' }}>All server sessions ({data.sessions.length})</h3>
          <div className="event-scroll" style={{ maxHeight: 200 }}>
            <table className="event-table">
              <thead><tr><th>User</th><th>Issued to</th><th>Rot.</th><th>Logged out</th></tr></thead>
              <tbody>{data.sessions.map((s) => <tr key={s.id}><td>{s.userEmail}</td><td>{s.issuedTo}</td><td>{s.rotations}</td><td>{s.loggedOutAt ? 'yes' : 'no'}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function AuditPanel() {
  const [checks, setChecks] = useState([]);
  const [results, setResults] = useState(null);
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/api/lab/audit').then((d) => { setChecks(d.checks); setMode(d.mode); }).catch(() => {}); }, []);

  const run = async () => {
    setBusy(true);
    try {
      const d = await api('/api/lab/audit/run', { method: 'POST' });
      setResults(d.results);
      setMode(d.mode);
    } catch { /* ignore */ }
    setBusy(false);
  };

  return (
    <div>
      <div className="lab-btn-row" style={{ marginBottom: 16 }}>
        <button type="button" className="lab-btn primary" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run live audit'}</button>
        {results && <span style={{ fontSize: 12.5, color: 'var(--lab-muted)', alignSelf: 'center' }}>Probed the running server in {mode} mode.</span>}
      </div>
      {checks.map((c) => {
        const r = results?.[c.id];
        return (
          <div key={c.id}>
            <div className="audit-row">
              <div className={`audit-status ${r ? (r.pass ? 'pass' : 'fail') : ''}`}>{r ? (r.pass ? '✓' : '✕') : '•'}</div>
              <div>
                <h4>{c.title} <span className={`sev ${c.severity}`}>{c.severity}</span></h4>
                <div className="audit-detail">
                  <div className="cmp">
                    <div><strong style={{ color: 'var(--lab-red)' }}>Vulnerable</strong><br /><code>{c.vulnerable}</code></div>
                    <div><strong style={{ color: 'var(--lab-green)' }}>Secure</strong><br /><code>{c.secure}</code></div>
                  </div>
                  <p style={{ margin: '4px 0' }}><strong>Risk:</strong> {c.risk}</p>
                  <p style={{ margin: '4px 0' }}><strong>Fix:</strong> {c.mitigation} <span style={{ color: 'var(--lab-gold)' }}>({c.owasp})</span></p>
                  {r && <p className="audit-evidence">Live: {r.evidence}</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CaptureViewer({ lab }) {
  const [captures, setCaptures] = useState([]);
  const load = () => api(`/api/lab/captures${lab ? `?lab=${lab}` : ''}`).then((d) => setCaptures(d.captures)).catch(() => {});
  useEffect(load, [lab]);
  if (captures.length === 0) return <p style={{ color: 'var(--lab-muted)' }}>No captured requests yet. Run the exercise to populate this.</p>;
  return (
    <div>
      <button type="button" className="lab-btn" onClick={load} style={{ marginBottom: 12 }}>Refresh</button>
      {captures.map((c) => (
        <div key={c.id} className="capture">
          <div className="lab-mono"><span className="ev-tag">{c.mode}</span> {c.request.method} {c.request.url}</div>
          <pre>{`Origin:         ${c.request.headers.origin}
Referer:        ${c.request.headers.referer}
Sec-Fetch-Site: ${c.request.headers['sec-fetch-site']}
X-CSRF-Token:   ${c.request.headers['x-csrf-token']}
Cookie:         ${c.request.headers.cookie}
Body:           ${JSON.stringify(c.request.body)}
Response:       HTTP ${c.response.status} ${c.response.note || c.response.error || ''}`}</pre>
          {(c.before_value !== null || c.after_value !== null) && (
            <div className="diff">
              <div className="before"><strong>Before</strong><br />{c.before_value}</div>
              <div className="after"><strong>After</strong><br />{c.after_value}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function QueryInspector() {
  const [queries, setQueries] = useState([]);
  const load = () => api('/api/lab/queries').then((d) => setQueries(d.queries)).catch(() => {});
  useEffect(load, []);
  return (
    <div>
      <button type="button" className="lab-btn" onClick={load} style={{ marginBottom: 12 }}>Refresh</button>
      {queries.length === 0 && <p style={{ color: 'var(--lab-muted)' }}>No queries recorded yet. Use the login or search form.</p>}
      {queries.map((q, i) => (
        <div key={i} className={`query-item ${q.mode}`}>
          <span className="q-src">{q.source} · {q.mode} · {q.error ? 'error' : `${q.rows} row(s)`}</span>
          <pre>{q.sql}</pre>
          {q.params && <pre style={{ color: 'var(--lab-blue)' }}>params: {JSON.stringify(q.params)}</pre>}
          {q.error && <pre style={{ color: 'var(--lab-red)' }}>{q.error}</pre>}
        </div>
      ))}
    </div>
  );
}
