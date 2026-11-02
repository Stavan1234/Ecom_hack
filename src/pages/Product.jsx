import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, imageUrl, money, shortDate } from '../api.js';
import { EmptyState, ProductGrid, Spinner, Stars } from '../components.jsx';
import { useApp } from '../store.jsx';

function Reviews({ slug, reviews, rendering, canReview, onAdd }) {
  const { user, notify } = useApp();
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(5);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api(`/api/products/${slug}/reviews`, { method: 'POST', body: { body, rating } });
      onAdd(d.review);
      setBody('');
      notify('Thank you for your review.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="reviews">
      <h2>Owner reviews</h2>
      <div className="review-list">
        {reviews.length === 0 && <p className="muted">No reviews yet. Be the first to write one.</p>}
        {reviews.map((r) => (
          <article key={r.id} className="review">
            <div className="review-head">
              <strong>{r.author}</strong>
              <Stars value={r.rating} />
              <span className="review-date">{shortDate(r.created_at)}</span>
            </div>
            {/* In vulnerable mode the server marks reviews for raw rendering (Lab 5, stored XSS). */}
            {rendering === 'html'
              ? <p dangerouslySetInnerHTML={{ __html: r.body }} />
              : <p>{r.body}</p>}
          </article>
        ))}
      </div>
      {user ? (
        <form className="review-form" onSubmit={submit}>
          <h3>Write a review</h3>
          {error && <div className="inline-error">{error}</div>}
          <div className="field">
            <label htmlFor="rating">Rating</label>
            <select id="rating" className="select" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="body">Your review</label>
            <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} required placeholder="What do you think of this piece?" />
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Posting…' : 'Post review'}</button>
        </form>
      ) : (
        <p className="muted">Please <Link className="text-link" to="/login">sign in</Link> to write a review.</p>
      )}
    </section>
  );
}

export default function Product() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, notify, user } = useApp();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState('front');
  const [qty, setQty] = useState(1);
  const [wished, setWished] = useState(false);

  useEffect(() => {
    setData(null);
    setNotFound(false);
    setView('front');
    setQty(1);
    api(`/api/products/${slug}`)
      .then((d) => { setData(d); setWished(d.wished); })
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return <div className="page"><EmptyState title="Piece not found" action={<Link className="btn" to="/shop">Browse the collection</Link>}>We could not find that piece.</EmptyState></div>;
  }
  if (!data) return <div className="page"><Spinner /></div>;

  const { product, reviews, related, reviewRendering } = data;
  const isCar = product.category === 'automobiles';
  const views = isCar ? ['front', 'detail', 'rear', 'wheel'] : ['front', 'dial', 'crown'];
  const soldOut = product.stock === 0;

  const toggleWish = async () => {
    if (!user) return navigate('/login?next=/product/' + slug);
    try {
      if (wished) { await api(`/api/wishlist/${slug}`, { method: 'DELETE' }); setWished(false); notify('Removed from wishlist'); }
      else { await api(`/api/wishlist/${slug}`, { method: 'POST' }); setWished(true); notify('Saved to wishlist'); }
    } catch (e) { notify(e.message); }
  };

  return (
    <div className="page product-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> / <Link to={`/shop/${product.category}`}>{product.collection}</Link> / <span>{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="gallery">
          <div className="gallery-main"><img src={imageUrl(product.slug, view)} alt={`${product.name}, ${view} view`} /></div>
          <div className="gallery-thumbs">
            {views.map((v) => (
              <button type="button" key={v} className={`thumb ${view === v ? 'active' : ''}`} onClick={() => setView(v)} aria-label={`${v} view`}>
                <img src={imageUrl(product.slug, v)} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div className="product-info">
          <p className="eyebrow">{product.collection} · {product.subcategory}</p>
          <h1>{product.name}</h1>
          <p className="product-price">{money(product.price)}</p>
          <p className="product-short">{product.short}</p>
          <p className="product-desc">{product.description}</p>

          <div className="stock-line">
            {soldOut ? <span className="stock out">Currently unavailable</span>
              : product.stock <= 3 ? <span className="stock low">Only {product.stock} available</span>
              : <span className="stock ok">In stock</span>}
          </div>

          <div className="buy-row">
            <div className="qty">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">−</button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(product.stock || 1, q + 1))} aria-label="Increase">+</button>
            </div>
            <button type="button" className="btn block" disabled={soldOut} onClick={() => { addToCart(slug, qty); notify(`${product.name} added to your bag`); }}>
              {soldOut ? 'Sold out' : 'Add to bag'}
            </button>
          </div>
          <button type="button" className={`wish-btn ${wished ? 'on' : ''}`} onClick={toggleWish}>
            {wished ? '♥ Saved to wishlist' : '♡ Add to wishlist'}
          </button>

          <dl className="specs">
            {Object.entries(product.specs).map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </div>
      </div>

      <Reviews slug={slug} reviews={reviews} rendering={reviewRendering} onAdd={(r) => setData((d) => ({ ...d, reviews: [r, ...d.reviews] }))} />

      {related.length > 0 && (
        <section className="section" style={{ padding: '64px 0 0' }}>
          <div className="section-head"><h2>You may also like</h2></div>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
