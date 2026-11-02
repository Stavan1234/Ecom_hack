import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, imageUrl } from '../api.js';
import { EmptyState } from '../components.jsx';

export function About() {
  return (
    <div className="page editorial">
      <header className="page-head"><p className="eyebrow">The Maison</p><h1>Our story</h1></header>
      <img className="editorial-hero" src={imageUrl('voss-gt-sterling')} alt="" />
      <div className="prose">
        <p className="lead">Halden &amp; Voss began, in our fiction, in 1889, when a watchmaker and a coachbuilder shared a workshop and an obsession with what happens on the inside of a beautiful object.</p>
        <p>More than a century later we still make two things: mechanical watches, finished by hand in Geneva, and automobiles bodied by hand in our coachworks. We make very few of each. We would rather be known by the people who own our work than by the number of pieces we sell.</p>
        <h2>Made by people</h2>
        <p>Every movement is assembled, disassembled, adjusted and reassembled by a single watchmaker. Every car body is formed over a wooden buck and painted over many weeks. Nothing leaves the atelier until the person who made it is satisfied.</p>
        <h2>Kept for life</h2>
        <p>We service everything we have ever made, by the original workshop. A Halden &amp; Voss piece is meant to outlive its first owner, and usually does.</p>
      </div>
    </div>
  );
}

export function Boutiques() {
  const list = [
    ['Geneva', 'Rue du Rhône 14', 'The flagship, beside the lake. Watchmaking atelier on the first floor.'],
    ['London', 'Mount Street, Mayfair', 'By appointment, with a private viewing room.'],
    ['Paris', 'Place Vendôme 8', 'Timepieces and high complications.'],
    ['Milan', 'Via Montenapoleone 21', 'Shared with the Voss Automobili showroom.'],
    ['Tokyo', 'Ginza Six', 'Our largest atelier in Asia.'],
    ['Dubai', 'DIFC Gate Village', 'Private client lounge and servicing.'],
  ];
  return (
    <div className="page">
      <header className="page-head"><p className="eyebrow">Visit us</p><h1>Boutiques</h1><p>Six fictional addresses, each with a private appointment room.</p></header>
      <div className="boutique-grid">
        {list.map(([city, address, note]) => (
          <div key={city} className="boutique-card">
            <h3>{city}</h3>
            <p className="boutique-address">{address}</p>
            <p>{note}</p>
            <span className="text-link">Book an appointment</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Care() {
  return (
    <div className="page editorial">
      <header className="page-head"><p className="eyebrow">Ownership</p><h1>Care &amp; servicing</h1></header>
      <div className="prose">
        <p className="lead">A mechanical object lasts as long as it is looked after. Here is how we look after yours.</p>
        <h2>Watches</h2>
        <p>We recommend a full service every five years. Between services, keep your watch away from magnets, rinse the case after contact with salt water, and store it on a winder or let it rest.</p>
        <h2>Automobiles</h2>
        <p>Each car comes with a service book and a dedicated technician. We collect and return within Europe for scheduled servicing.</p>
        <h2>Warranty</h2>
        <p>Every movement carries a five-year international warranty. Servicing by the original workshop keeps it valid for life.</p>
      </div>
    </div>
  );
}

export function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [state, setState] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    setState({});
    try {
      await api('/api/contact', { method: 'POST', body: form });
      setState({ ok: true });
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) { setState({ error: err.message }); }
  };
  if (state.ok) {
    return <div className="page narrow"><EmptyState title="Message received" action={<Link className="btn" to="/">Return home</Link>}>Thank you for writing. A fictional member of our client team would normally reply within one working day.</EmptyState></div>;
  }
  return (
    <div className="page narrow">
      <header className="page-head"><p className="eyebrow">Client service</p><h1>Contact us</h1><p>We would be glad to help with an enquiry, an appointment or a servicing request.</p></header>
      {state.error && <div className="inline-error">{state.error}</div>}
      <form onSubmit={submit} className="contact-form">
        <div className="field-row">
          <div className="field"><label>Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Email</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="field"><label>Subject</label><input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
        <div className="field"><label>Message</label><textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
        <button className="btn">Send message</button>
      </form>
    </div>
  );
}

const ARTICLES = {
  'what-a-tourbillon-does': {
    title: 'What a tourbillon actually does', eyebrow: 'From the bench', slug: 'grand-atelier-tourbillon',
    body: ['The tourbillon was patented in 1801 to fight a specific enemy: gravity. In a pocket watch, which spends its life in one vertical position, gravity pulls unevenly on the balance wheel and the watch runs a little fast or slow.',
      'The solution was to put the whole escapement in a rotating cage. As it turns, the positional errors average out. It is a genuinely clever answer to a real problem.',
      'On a wrist, which moves constantly, the problem mostly solves itself, so a modern tourbillon is largely an act of devotion to the craft. We make one anyway, because watching 0.4 grams of steel turn once a minute is one of the quiet pleasures of this trade.'],
  },
  'coachbuilding-by-hand': {
    title: 'Why we still beat metal by hand', eyebrow: 'The coachworks', slug: 'voss-gt-berlinetta',
    body: ['A body panel can be pressed by a machine in seconds. Ours take days. A craftsperson works a flat sheet of aluminium over a shaped wooden buck, checking the curve against the buck again and again.',
      'The result is not measurably better by any instrument. It is better in a way you feel when the light runs along the flank of the car. That is the whole argument, and we find it sufficient.'],
  },
};

export function Journal() {
  const items = Object.entries(ARTICLES);
  return (
    <div className="page">
      <header className="page-head"><p className="eyebrow">Reading</p><h1>Journal</h1><p>Notes from the atelier and the coachworks.</p></header>
      <div className="journal-grid">
        {items.map(([slug, a]) => (
          <Link key={slug} to={`/journal/${slug}`} className="journal-card">
            <img src={imageUrl(a.slug)} alt="" />
            <div><p className="eyebrow">{a.eyebrow}</p><h3>{a.title}</h3><span className="text-link">Read</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function JournalArticle() {
  const { slug } = useParams();
  const article = ARTICLES[slug];
  if (!article) return <div className="page"><EmptyState title="Article not found" action={<Link className="btn" to="/journal">Back to the journal</Link>} /></div>;
  return (
    <div className="page editorial">
      <header className="page-head"><p className="eyebrow">{article.eyebrow}</p><h1>{article.title}</h1></header>
      <img className="editorial-hero" src={imageUrl(article.slug)} alt="" />
      <div className="prose">{article.body.map((p, i) => <p key={i} className={i === 0 ? 'lead' : ''}>{p}</p>)}</div>
    </div>
  );
}

const POLICIES = {
  shipping: ['Shipping', 'Every order is delivered by insured courier at no charge. In this fictional shop nothing physically ships, so no tracking number is ever issued.'],
  returns: ['Returns', 'A real maison would offer 30 days to return an unworn piece. Here, since nothing is purchased or shipped, there is nothing to return.'],
  privacy: ['Privacy', 'This is a training application. Accounts, orders and details are fabricated. Do not enter real personal information. Event logs are kept locally and redact secrets.'],
  terms: ['Terms', 'Halden & Voss is a fictional brand built for a security course. The site is for local, educational use and sells nothing.'],
};

export function Policies() {
  const { topic } = useParams();
  const policy = POLICIES[topic];
  if (!policy) return <div className="page"><EmptyState title="Page not found" action={<Link className="btn" to="/">Home</Link>} /></div>;
  return (
    <div className="page editorial narrow">
      <header className="page-head"><p className="eyebrow">Policies</p><h1>{policy[0]}</h1></header>
      <div className="prose"><p className="lead">{policy[1]}</p></div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page">
      <EmptyState title="Page not found" action={<Link className="btn" to="/">Return home</Link>}>
        The page you were looking for does not exist.
      </EmptyState>
    </div>
  );
}
