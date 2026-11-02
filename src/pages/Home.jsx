import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, imageUrl } from '../api.js';
import { ProductGrid, SkeletonGrid } from '../components.jsx';

const COLLECTIONS = [
  { to: '/shop/timepieces', title: 'Timepieces', text: 'Dress, dive, chronograph and grand complication.', slug: 'veloce-chronograph-panda' },
  { to: '/shop/automobiles', title: 'Automobiles', text: 'Hand-bodied grand tourers and hypercars.', slug: 'voss-spyder-s' },
  { to: '/shop/accessories', title: 'Atelier', text: 'Straps, winders and tools from our workshop.', slug: 'atelier-winder-duo' },
];

export default function Home() {
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    api('/api/products?featured=1&limit=8').then((d) => setFeatured(d.products)).catch(() => setFeatured([]));
  }, []);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">The Winter Collection</p>
          <h1>Time, kept<br /><em>beautifully.</em></h1>
          <p className="hero-lede">Mechanical watches and hand-built automobiles, made in small numbers by people who still care how the inside looks.</p>
          <div className="hero-cta">
            <Link to="/shop/timepieces" className="btn">Discover timepieces</Link>
            <Link to="/product/grand-atelier-tourbillon" className="btn ghost">The Tourbillon</Link>
          </div>
        </div>
        <div className="hero-art">
          <img src={imageUrl('grand-atelier-tourbillon')} alt="Grand Atelier Tourbillon with a burgundy dial" />
        </div>
      </section>

      <section className="trust-row" aria-label="Our promises">
        <div><b>5-year warranty</b><span>On every movement</span></div>
        <div><b>Complimentary delivery</b><span>Insured, door to door</span></div>
        <div><b>Private appointments</b><span>In six boutiques</span></div>
        <div><b>Lifetime servicing</b><span>By the original workshop</span></div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Explore the Maison</h2>
        </div>
        <div className="collection-grid">
          {COLLECTIONS.map((c) => (
            <Link to={c.to} key={c.to} className="collection-card">
              <img src={imageUrl(c.slug)} alt="" loading="lazy" />
              <div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Selected pieces</h2>
          <Link to="/shop" className="text-link">View everything</Link>
        </div>
        {featured ? <ProductGrid products={featured} /> : <SkeletonGrid count={8} />}
      </section>

      <section className="feature-band">
        <div className="feature-art"><img src={imageUrl('voss-gt-berlinetta')} alt="Voss GT Berlinetta in racing green" loading="lazy" /></div>
        <div className="feature-text">
          <p className="eyebrow light">Voss Automobili</p>
          <h2>Six and a half litres, formed by hand.</h2>
          <p>Every Berlinetta body is beaten over a wooden buck in our coachworks, then painted over eleven weeks. We build ninety-nine a year, and we know every owner by name.</p>
          <Link to="/product/voss-gt-berlinetta" className="btn light">Meet the Berlinetta</Link>
        </div>
      </section>

      <section className="section story">
        <div>
          <p className="eyebrow">From the journal</p>
          <h2>What a tourbillon actually does</h2>
          <p>It was invented to fight gravity in a pocket. On a wrist it hardly needs to, and we make one anyway. An honest account from the bench.</p>
          <Link to="/journal/what-a-tourbillon-does" className="text-link">Read the article</Link>
        </div>
        <img src={imageUrl('grand-atelier-tourbillon', 'dial')} alt="Close view of a tourbillon dial" loading="lazy" />
      </section>
    </div>
  );
}
