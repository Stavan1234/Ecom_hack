import { useEffect, useState } from 'react';
import { api } from '../api.js';

// A deliberately plain, chrome-free page with a single action button at a fixed
// position. It is the framing target for Lab 3. Secure mode sends X-Frame-Options
// and frame-ancestors, so the browser refuses to render it inside a foreign frame.
export default function VipInvitation() {
  const [framed, setFramed] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setFramed(window.top !== window.self);
  }, []);

  const join = async () => {
    setError(null);
    try {
      await api('/api/vip-optin', { method: 'POST', body: { framed, parent: document.referrer } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="vip-page">
      <div className="vip-card">
        <p className="eyebrow">Halden &amp; Voss</p>
        <h1>Join the Private Client list</h1>
        <p>Early access to new releases and invitations to private viewings.</p>
        {done
          ? <p className="vip-done">You are on the Private Client list.</p>
          : <button type="button" className="vip-button" onClick={join}>Join the Private Client list</button>}
        {error && <p className="vip-error">{error}</p>}
      </div>
    </div>
  );
}
