import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

// The engraving preview reads the text from the URL fragment (after #), which the
// server never receives. In vulnerable mode the client writes it with innerHTML;
// in secure mode it uses textContent. This is the DOM-based rendering path for Lab 5.
function readFragmentText() {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  return params.get('text') ?? '';
}

export default function Engraving() {
  const { mode } = useApp();
  const previewRef = useRef(null);
  const [text, setText] = useState(readFragmentText);
  const [input, setInput] = useState(text);

  useEffect(() => {
    const onHash = () => setText(readFragmentText());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    if (mode === 'secure') {
      el.textContent = text || 'Your engraving will appear here';
      if (/[<>]/.test(text)) {
        api('/api/lab/client-event', { method: 'POST', body: { type: 'dom-neutralized', input: text } }).catch(() => {});
      }
    } else {
      // VULNERABLE: untrusted fragment written as HTML.
      el.innerHTML = text || 'Your engraving will appear here';
    }
  }, [text, mode]);

  const apply = () => {
    const encoded = new URLSearchParams({ text: input }).toString();
    window.location.hash = encoded;
    setText(input);
  };

  return (
    <div className="page narrow engraving">
      <header className="page-head"><p className="eyebrow">Atelier service</p><h1>Engraving studio</h1><p>Preview a personal engraving for the caseback of your timepiece.</p></header>

      <div className="engrave-preview">
        <div className="engrave-plate"><div ref={previewRef} className="engrave-text" /></div>
      </div>

      <div className="field"><label htmlFor="engrave">Engraving text</label><input id="engrave" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. For Sam, with love" /></div>
      <button type="button" className="btn" onClick={apply}>Preview engraving</button>

      <div className="inline-note" style={{ marginTop: 24 }}>
        The preview text is taken from the part of the address after <code>#</code>, which the browser never sends to the server. That makes this the DOM-based exercise in <Link className="text-link" to="/lab/xss">Lab 5</Link>.
      </div>
    </div>
  );
}
