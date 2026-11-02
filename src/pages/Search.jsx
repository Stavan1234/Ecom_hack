import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState, ProductGrid, Spinner } from '../components.jsx';

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    setState({ loading: true });
    api(`/api/search?q=${encodeURIComponent(q)}`)
      .then((d) => setState({ loading: false, products: d.products }))
      .catch((e) => setState({ loading: false, products: [], error: e.message }));
  }, [q]);

  return (
    <div className="page">
      <header className="page-head">
        <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> / <span>Search</span></nav>
        <h1>Search</h1>
        <p>{state.loading ? 'Searching…' : `${state.products?.length ?? 0} result${state.products?.length === 1 ? '' : 's'} for “${q}”`}</p>
      </header>

      {state.loading ? <Spinner label="Searching the collection" />
        : state.error ? <EmptyState title="That search could not be completed">{state.error}</EmptyState>
        : state.products.length === 0 ? <EmptyState title="No pieces found" action={<Link className="btn" to="/shop">Browse everything</Link>}>We could not find anything for “{q}”.</EmptyState>
        : <ProductGrid products={state.products} />}
    </div>
  );
}
