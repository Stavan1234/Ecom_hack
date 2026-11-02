let csrfToken = null;

export function setCsrfToken(token) {
  csrfToken = token;
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
  const res = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await res.json() : { error: await res.text() };
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status, data);
  if (data.csrfToken !== undefined) csrfToken = data.csrfToken;
  return data;
}

export const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n) || 0);
export const shortDate = (v) => new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const clockTime = (v) => new Date(v).toLocaleTimeString('en-GB', { hour12: false });
export const imageUrl = (slug, view) => `/img/product/${encodeURIComponent(slug)}${view ? `--${view}` : ''}.svg`;
