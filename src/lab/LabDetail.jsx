import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { AuditPanel, CaptureViewer, EventLog, QueryInspector, SessionInspector, copy } from './panels.jsx';

function Section({ title, children }) {
  return <section className="lab-section"><h2>{title}</h2>{children}</section>;
}

function LabTools({ lab, status, refresh }) {
  const [copied, setCopied] = useState(false);
  const [flag, setFlag] = useState('');
  const [flagMsg, setFlagMsg] = useState(null);
  const attacker = status?.attackerOrigin ?? 'http://127.0.0.1:4001';
  const crossSite = status?.crossSiteAttackerOrigin ?? 'http://localhost:4001';

  const submitFlag = async () => {
    try {
      const d = await api('/api/lab/flag', { method: 'POST', body: { flag } });
      setFlagMsg({ ok: d.correct, text: d.message });
      refresh?.();
    } catch (e) { setFlagMsg({ ok: false, text: e.message }); }
  };

  switch (lab.id) {
    case 'session':
      return <div className="lab-panel"><h2>This browser's session</h2><SessionInspector /></div>;
    case 'csrf':
      return (
        <>
          <div className="lab-panel"><h2>Attacker page</h2>
            <p style={{ color: 'var(--lab-muted)', fontSize: 13 }}>Open in the same browser where you are signed in.</p>
            <div className="lab-links">
              <a href={`${attacker}/csrf`} target="_blank" rel="noreferrer">{attacker}/csrf (same-site)</a>
              <a href={`${crossSite}/csrf`} target="_blank" rel="noreferrer">{crossSite}/csrf (cross-site)</a>
            </div>
          </div>
          <div className="lab-panel"><h2>Captured profile requests</h2><CaptureViewer lab="csrf" /></div>
        </>
      );
    case 'clickjacking':
      return (
        <div className="lab-panel"><h2>Attacker page</h2>
          <div className="lab-links">
            <a href={`${attacker}/clickjack`} target="_blank" rel="noreferrer">{attacker}/clickjack</a>
            <a href="/vip-invitation" target="_blank" rel="noreferrer">The framing target (/vip-invitation)</a>
          </div>
          <p style={{ color: 'var(--lab-muted)', fontSize: 13, marginTop: 10 }}>Sign in first, then open the attacker page in the same browser.</p>
        </div>
      );
    case 'sqli':
      return (
        <>
          <div className="lab-panel"><h2>Query inspector</h2><QueryInspector /></div>
          <div className="lab-panel"><h2>Submit the flag</h2>
            <p style={{ color: 'var(--lab-muted)', fontSize: 13 }}>Extract it from the <code>internal_notes</code> table with a UNION-based search.</p>
            <div className="flag-box">
              <input placeholder="FLAG{...}" value={flag} onChange={(e) => setFlag(e.target.value)} />
              <button type="button" className="lab-btn primary" onClick={submitFlag}>Submit</button>
            </div>
            {flagMsg && <p className={`flag-msg ${flagMsg.ok ? 'ok' : 'no'}`}>{flagMsg.text}</p>}
            {lab.hints && <div style={{ marginTop: 14 }}>{lab.hints.map((h, i) => <div key={i} className="hint">{h}</div>)}</div>}
          </div>
        </>
      );
    case 'xss':
      return (
        <div className="lab-panel"><h2>Proof-of-concept payloads</h2>
          <p style={{ color: 'var(--lab-muted)', fontSize: 13, marginBottom: 10 }}>Harmless alert only. Copy and use in the matching context.</p>
          {(lab.payloads ?? []).map((p) => (
            <div key={p.label} className="payload-row">
              <code>{p.value}</code>
              <button type="button" onClick={() => copy(p.value, setCopied)}>{copied ? '✓' : 'copy'}</button>
            </div>
          ))}
          <div className="lab-links" style={{ marginTop: 12 }}>
            <a href="/classic/search?q=%3Cb%3Etest%3C%2Fb%3E" target="_blank" rel="noreferrer">Reflected target (classic search)</a>
            <Link to="/engraving">DOM target (engraving studio)</Link>
          </div>
        </div>
      );
    case 'idor':
      return (
        <div className="lab-panel"><h2>Access-control tester</h2>
          <p style={{ color: 'var(--lab-muted)', fontSize: 13 }}>Signed in as the student, try reaching another customer's objects.</p>
          <div className="lab-links">
            <a href="/account/orders/1003" target="_blank" rel="noreferrer">/account/orders/1003 (Alice's order)</a>
            <a href="/api/orders/1003" target="_blank" rel="noreferrer">/api/orders/1003 (raw API)</a>
            <a href="/api/users/3" target="_blank" rel="noreferrer">/api/users/3 (Alice's profile)</a>
            <a href="/api/admin/users" target="_blank" rel="noreferrer">/api/admin/users (admin API)</a>
          </div>
          <MassAssign refresh={refresh} />
        </div>
      );
    case 'audit':
      return <div className="lab-panel span2"><h2>Configuration audit</h2><AuditPanel /></div>;
    case 'forensics':
      return <div className="lab-panel span2"><h2>Event timeline</h2><EventLog /><p style={{ marginTop: 10 }}><Link to="/lab/evidence">Export redacted evidence →</Link></p></div>;
    default:
      return null;
  }
}

function MassAssign({ refresh }) {
  const [msg, setMsg] = useState(null);
  const promote = async () => {
    try {
      await api('/api/profile', { method: 'POST', body: { role: 'admin' } });
      setMsg('Sent role=admin. Refresh the storefront; check your account.');
      refresh?.();
    } catch (e) { setMsg(e.message); }
  };
  const restore = async () => {
    try { await api('/api/profile', { method: 'POST', body: { role: 'customer' } }); setMsg('Role restored to customer.'); refresh?.(); } catch (e) { setMsg(e.message); }
  };
  return (
    <div style={{ marginTop: 14 }}>
      <div className="lab-btn-row">
        <button type="button" className="lab-btn" onClick={promote}>Send role=admin</button>
        <button type="button" className="lab-btn" onClick={restore}>Restore role</button>
      </div>
      {msg && <p className="audit-evidence" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

export default function LabDetail() {
  const { labId } = useParams();
  const [lab, setLab] = useState(null);
  const [status, setStatus] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [openViva, setOpenViva] = useState(null);

  const refresh = () => api('/api/lab/status').then(setStatus).catch(() => {});

  useEffect(() => {
    setLab(null);
    setNotFound(false);
    api('/api/lab/curriculum').then((d) => {
      const found = d.labs.find((l) => l.id === labId);
      if (found) setLab(found); else setNotFound(true);
    }).catch(() => setNotFound(true));
    refresh();
  }, [labId]);

  if (notFound) return <div className="lab-panel"><p>Lab not found. <Link to="/lab">Back to the control centre</Link>.</p></div>;
  if (!lab) return <p style={{ color: 'var(--lab-muted)' }}>Loading the lab…</p>;

  const labStatus = status?.progress.labs.find((l) => l.id === lab.id);
  const toggleChallenge = async (c) => {
    if (c.auto) return;
    await api('/api/lab/progress', { method: 'POST', body: { challengeId: c.id, done: !c.done } }).catch(() => {});
    refresh();
  };

  return (
    <div>
      <div className="lab-detail-head">
        <Link to="/lab" className="lab-back">← Control centre</Link>
        <p className="eyebrow" style={{ marginTop: 10 }}>Lab {lab.number} · {lab.practical}</p>
        <h1>{lab.title}</h1>
      </div>

      <div className="lab-doc" style={{ marginTop: 20 }}>
        <div>
          <Section title="Objective"><p>{lab.objective}</p></Section>
          <Section title="What is it?"><p>{lab.what}</p></Section>
          <Section title="How it works"><p>{lab.how}</p></Section>
          <Section title="Why it happens"><p>{lab.why}</p></Section>
          <Section title="Concepts to understand"><div className="chip-list">{lab.concepts.map((c) => <span key={c}>{c}</span>)}</div></Section>
          <Section title="Prerequisites"><ul>{lab.prerequisites.map((p, i) => <li key={i}>{p}</li>)}</ul></Section>
          <Section title="Step by step"><ol>{lab.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></Section>
          <Section title="Expected result"><ul>{lab.expected.map((e, i) => <li key={i}>{e}</li>)}</ul></Section>
          <Section title="What to watch in DevTools"><ul>{lab.devtools.map((d, i) => <li key={i}>{d}</li>)}</ul></Section>
          <Section title="Evidence to capture"><ul>{lab.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul></Section>
          {lab.safety && <Section title="Safety"><p>{lab.safety}</p></Section>}
          <Section title="How to fix it"><ul>{lab.fix.map((f, i) => <li key={i}>{f}</li>)}</ul></Section>
          <Section title="How secure mode behaves"><p>{lab.secureBehaviour}</p></Section>
          <Section title="Viva questions">
            {lab.viva.map((v, i) => (
              <div key={i} className="viva-item">
                <div className="viva-q" onClick={() => setOpenViva(openViva === i ? null : i)}><span>{openViva === i ? '−' : '+'}</span> {v.q}</div>
                {openViva === i && <p className="viva-a">{v.a}</p>}
              </div>
            ))}
          </Section>
        </div>

        <aside className="lab-aside">
          <div className="lab-panel">
            <h2>Challenges</h2>
            {(labStatus?.challenges ?? lab.challenges).map((c) => (
              <div key={c.id} className={`challenge-item ${c.done ? 'done' : ''}`}>
                <button type="button" className="tick" onClick={() => toggleChallenge(c)} aria-label="Toggle">{c.done ? '✓' : ''}</button>
                <span>{c.title}</span>
                {c.auto && <span className="challenge-auto">auto</span>}
              </div>
            ))}
          </div>
          <LabTools lab={lab} status={status} refresh={refresh} />
        </aside>
      </div>
    </div>
  );
}
