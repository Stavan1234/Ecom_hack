import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState, ProductGrid, SkeletonGrid } from '../components.jsx';

const TITLES = {
  timepieces: ['Timepieces', 'Mechanical watches, finished by hand in small numbers.'],
  automobiles: ['Automobiles', 'Grand tourers, roadsters and hypercars from Voss Automobili.'],
  accessories: ['Atelier', 'Straps, winders and tools from our own workshop.'],
};

export default function Shop() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState(null);
  const [subs, setSubs] = useState([]);

  const sub = params.get('sub') ?? '';
  const sort = params.get('sort') ?? 'featured';
  const inStock = params.get('inStock') === '1';

  useEffect(() => {
    api('/api/categories').then((d) => {
      setSubs(d.categories.filter((c) => !category || c.category === category));
    }).catch(() => setSubs([]));
  }, [category]);

  useEffect(() => {
    setProducts(null);
    const q = new URLSearchParams({ sort });
    if (category) q.set('category', category);
    if (sub) q.set('subcategory', sub);
    if (inStock) q.set('inStock', '1');
    api(`/api/products?${q}`).then((d) => setProducts(d.products)).catch(() => setProducts([]));
  }, [category, sub, sort, inStock]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const [title, lede] = TITLES[category] ?? ['The Collection', 'Everything we make, in one place.'];
  const subcategories = [...new Set(subs.map((s) => s.subcategory))];

  return (
    <div className="page">
      <header className="page-head">
        <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> / <span>{title}</span></nav>
        <h1>{title}</h1>
        <p>{lede}</p>
      </header>

      <div className="filter-bar">
        <div className="chips" role="group" aria-label="Filter by type">
          <button type="button" className={`chip ${!sub ? 'active' : ''}`} onClick={() => update('sub', '')}>All</button>
          {subcategories.map((s) => (
            <button type="button" key={s} className={`chip ${sub === s ? 'active' : ''}`} onClick={() => update('sub', s)}>{s}</button>
          ))}
        </div>
        <div className="filter-right">
          <label><input type="checkbox" checked={inStock} onChange={(e) => update('inStock', e.target.checked ? '1' : '')} /> In stock only</label>
          <select className="select" value={sort} onChange={(e) => update('sort', e.target.value === 'featured' ? '' : e.target.value)} aria-label="Sort">
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low to high</option>
            <option value="price-desc">Price: High to low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>
      </div>

      {!products ? <SkeletonGrid count={8} />
        : products.length === 0 ? <EmptyState title="Nothing matches those filters">Try removing a filter to see more of the collection.</EmptyState>
        : <ProductGrid products={products} />}
    </div>
  );
}
