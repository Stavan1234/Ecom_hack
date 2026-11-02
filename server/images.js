// Procedural studio renders for the catalogue, so the shop has rich imagery without
// any third-party images or outbound requests.

const METALS = {
  steel: ['#f4f5f6', '#9ea3a8', '#e2e4e6', '#6d7277'],
  gold: ['#fff0bd', '#b98f3e', '#f1d58a', '#7c5c20'],
  rose: ['#ffe2d2', '#b97a5e', '#f0bfa6', '#7d4a35'],
  titanium: ['#c3c5c7', '#6f7276', '#a4a7aa', '#4b4e52'],
  bronze: ['#e7bf8c', '#8a5d30', '#c99a62', '#5c3c1c'],
  black: ['#55565a', '#141417', '#3a3b3f', '#08080a'],
  platinum: ['#ffffff', '#b2b6bc', '#eceef0', '#858a90'],
};

const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)];
};

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const ARABIC = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

function radialTicks(cx, cy, r1, r2, count, color, width, opacity = 1) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const deg = (360 / count) * i;
    const [x1, y1] = polar(cx, cy, r1, deg);
    const [x2, y2] = polar(cx, cy, r2, deg);
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
  }
  return out;
}

function hand(cx, cy, deg, length, width, color, tail = 26, shadow = true) {
  const pts = `${-width / 2},${tail} 0,${-length} ${width / 2},${tail}`;
  const shade = shadow
    ? `<polygon points="${pts}" fill="#000" opacity=".28" transform="translate(${cx + 3} ${cy + 4}) rotate(${deg})"/>`
    : '';
  return `${shade}<polygon points="${pts}" fill="${color}" transform="translate(${cx} ${cy}) rotate(${deg})"/>
  <polygon points="0,${tail} 0,${-length} ${width / 2},${tail}" fill="#000" opacity=".18" transform="translate(${cx} ${cy}) rotate(${deg})"/>`;
}

function subDial(cx, cy, r, bg, fg, deg) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="${fg}" stroke-opacity=".35" stroke-width="1.5"/>
  ${radialTicks(cx, cy, r - 3, r - 9, 12, fg, 1.4, 0.8)}
  ${radialTicks(cx, cy, r - 12, r - 14, 60, fg, 0.6, 0.3)}
  <line x1="${cx}" y1="${cy}" x2="${polar(cx, cy, r - 7, deg)[0]}" y2="${polar(cx, cy, r - 7, deg)[1]}" stroke="${fg}" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="2.8" fill="${fg}"/>`;
}

function watchSvg(s, view) {
  const [m1, m2, m3, m4] = METALS[s.metal] ?? METALS.steel;
  const text = s.text ?? '#efece3';
  const handColor = s.hands ?? '#efece3';
  const cx = 400;
  const cy = 400;
  const isBracelet = s.strap === 'bracelet';
  const strapColor = isBracelet ? m2 : s.strap;

  const bracelet = () => {
    let links = '';
    for (const [y0, dir] of [[150, -1], [650, 1]]) {
      for (let i = 0; i < 6; i++) {
        const y = y0 + dir * i * 34;
        links += `<rect x="326" y="${y - 15}" width="46" height="30" rx="4" fill="url(#mt)"/><rect x="377" y="${y - 15}" width="46" height="30" rx="4" fill="url(#mt2)"/><rect x="428" y="${y - 15}" width="46" height="30" rx="4" fill="url(#mt)"/>`;
      }
    }
    return links;
  };
  const strap = () => `<path d="M322 225 L332 -20 L468 -20 L478 225 Z" fill="${strapColor}"/>
    <path d="M322 575 L332 820 L468 820 L478 575 Z" fill="${strapColor}"/>
    <path d="M322 225 L332 -20 L350 -20 L346 225 Z" fill="#fff" opacity=".05"/>
    <path d="M478 225 L468 -20 L452 -20 L456 225 Z" fill="#000" opacity=".28"/>
    <path d="M322 575 L332 820 L350 820 L346 575 Z" fill="#fff" opacity=".05"/>
    <path d="M478 575 L468 820 L452 820 L456 575 Z" fill="#000" opacity=".28"/>
    <path d="M341 225 L349 -20 M459 225 L451 -20 M341 575 L349 820 M459 575 L451 820" stroke="#fff" stroke-opacity=".2" stroke-width="1.4" stroke-dasharray="7 6" fill="none"/>`;

  let bezel = '';
  if (s.bezel === 'dive') {
    bezel = `<circle cx="${cx}" cy="${cy}" r="188" fill="${s.bezelColor ?? '#111'}"/>
      <circle cx="${cx}" cy="${cy}" r="188" fill="url(#gloss)" opacity=".55"/>
      ${radialTicks(cx, cy, 182, 170, 60, '#e9e6dc', 1.3, 0.75)}
      ${radialTicks(cx, cy, 183, 162, 12, '#f3f0e6', 4)}
      ${[10, 20, 30, 40, 50].map((n) => {
        const [x, y] = polar(cx, cy, 171, n * 6);
        return `<text x="${x}" y="${y + 7}" text-anchor="middle" font-size="19" font-family="Helvetica,Arial,sans-serif" font-weight="600" fill="#f3f0e6" transform="rotate(${n * 6} ${x} ${y})">${n}</text>`;
      }).join('')}
      <polygon points="${cx},${cy - 186} ${cx - 11},${cy - 165} ${cx + 11},${cy - 165}" fill="#f3f0e6"/>`;
  } else if (s.bezel === 'fluted') {
    bezel = `<circle cx="${cx}" cy="${cy}" r="186" fill="url(#mt)"/>${radialTicks(cx, cy, 186, 164, 120, m4, 2.4, 0.5)}`;
  } else if (s.bezel === 'tachy') {
    bezel = `<circle cx="${cx}" cy="${cy}" r="186" fill="${s.bezelColor ?? '#111'}"/>
      <circle cx="${cx}" cy="${cy}" r="186" fill="url(#gloss)" opacity=".5"/>
      ${radialTicks(cx, cy, 182, 174, 72, '#e9e6dc', 1, 0.7)}
      ${[60, 80, 100, 130, 160, 200, 250, 300, 400, 500].map((n) => {
        const deg = 3600 / n;
        const [x, y] = polar(cx, cy, 165, deg);
        return `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="13" font-family="Helvetica,Arial,sans-serif" fill="#ece9df" transform="rotate(${deg} ${x} ${y})">${n}</text>`;
      }).join('')}`;
  } else {
    bezel = `<circle cx="${cx}" cy="${cy}" r="186" fill="url(#mt2)"/>`;
  }

  const dialR = s.bezel === 'polished' ? 170 : 154;
  const applied = s.metal === 'gold' || s.metal === 'rose' ? m1 : '#f4f3ee';
  const indexColor = s.text && s.text !== '#efece3' ? s.text : applied;
  let indices = '';
  if (s.indices === 'baton') {
    indices = radialTicks(cx, cy, dialR - 12, dialR - 44, 12, indexColor, 8);
  } else if (s.indices === 'dot') {
    for (let i = 0; i < 12; i++) {
      const [x, y] = polar(cx, cy, dialR - 26, i * 30);
      indices += i % 3 === 0
        ? `<rect x="${x - 8}" y="${y - 19}" width="16" height="38" rx="3" fill="#f1eedc" stroke="${m3}" stroke-width="1.5" transform="rotate(${i * 30} ${x} ${y})"/>`
        : `<circle cx="${x}" cy="${y}" r="11" fill="#f1eedc" stroke="${m3}" stroke-width="1.5"/>`;
    }
  } else {
    const labels = s.indices === 'roman' ? ROMAN : ARABIC;
    const family = s.indices === 'roman' ? 'Georgia,serif' : 'Helvetica,Arial,sans-serif';
    labels.forEach((label, i) => {
      if (s.sub === 'small' && i === 6) return;
      if ((s.sub === 'moon' || s.sub === 'tourbillon') && i === 6) return;
      const [x, y] = polar(cx, cy, dialR - 34, i * 30);
      const rotate = s.indices === 'roman' ? ` transform="rotate(${i * 30} ${x} ${y})"` : '';
      indices += `<text x="${x}" y="${y + 11}" text-anchor="middle" font-size="${s.indices === 'roman' ? 26 : 34}" font-family="${family}" font-weight="${s.indices === 'roman' ? 400 : 600}" fill="${indexColor}"${rotate}>${label}</text>`;
    });
  }

  let complications = '';
  if (s.sub === 'chrono') {
    const bg = s.subColor ?? '#111';
    const fg = s.subColor && s.subColor.startsWith('#e') ? '#222' : '#eeeae0';
    complications = subDial(cx - 72, cy, 40, bg, fg, 40) + subDial(cx + 72, cy, 40, bg, fg, 200) + subDial(cx, cy + 74, 40, bg, fg, 310);
  } else if (s.sub === 'small') {
    complications = subDial(cx, cy + 86, 40, 'none', text, 120);
  } else if (s.sub === 'moon') {
    complications = `<g><clipPath id="mw"><path d="M${cx - 58} ${cy + 118} A58 58 0 0 1 ${cx + 58} ${cy + 118} Q${cx} ${cy + 90} ${cx - 58} ${cy + 118} Z"/></clipPath>
      <rect x="${cx - 62}" y="${cy + 56}" width="124" height="66" fill="#0e1f4d" clip-path="url(#mw)"/>
      <circle cx="${cx - 12}" cy="${cy + 86}" r="20" fill="#f1e2ac" clip-path="url(#mw)"/>
      <circle cx="${cx + 28}" cy="${cy + 74}" r="1.8" fill="#fff" clip-path="url(#mw)"/><circle cx="${cx + 40}" cy="${cy + 92}" r="1.3" fill="#fff" clip-path="url(#mw)"/><circle cx="${cx - 40}" cy="${cy + 76}" r="1.3" fill="#fff" clip-path="url(#mw)"/>
      <path d="M${cx - 58} ${cy + 118} A58 58 0 0 1 ${cx + 58} ${cy + 118}" fill="none" stroke="${m3}" stroke-width="2.4"/></g>`;
  } else if (s.sub === 'tourbillon') {
    complications = `<circle cx="${cx}" cy="${cy + 88}" r="50" fill="#0a0a0c" stroke="${m1}" stroke-width="3"/>
      ${radialTicks(cx, cy + 88, 46, 18, 3, m1, 5)}
      <circle cx="${cx}" cy="${cy + 88}" r="30" fill="none" stroke="${m3}" stroke-width="2"/>
      ${radialTicks(cx, cy + 88, 30, 25, 28, m3, 1.5)}
      <circle cx="${cx}" cy="${cy + 88}" r="12" fill="none" stroke="#d9c07a" stroke-width="3"/><circle cx="${cx}" cy="${cy + 88}" r="3.5" fill="#b3224d"/>`;
  }
  const date = s.date
    ? `<rect x="${cx + dialR - 76}" y="${cy - 15}" width="36" height="30" rx="2" fill="#f7f5ee" stroke="${m3}" stroke-width="2"/><text x="${cx + dialR - 58}" y="${cy + 8}" text-anchor="middle" font-size="20" font-family="Helvetica,Arial,sans-serif" fill="#1a1a1a">17</text>`
    : '';

  const hourDeg = 305;
  const minuteDeg = 62;
  const second = s.sub === 'chrono' ? 0 : 196;
  const handLen = dialR - 40;

  const views = { front: '0 0 800 800', dial: '215 215 370 370', crown: '420 250 300 300' };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${views[view] ?? views.front}" role="img">
  <defs>
    <radialGradient id="bg" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#34302a"/><stop offset=".6" stop-color="#1c1a17"/><stop offset="1" stop-color="#0f0e0c"/></radialGradient>
    <linearGradient id="mt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m1}"/><stop offset=".45" stop-color="${m2}"/><stop offset=".6" stop-color="${m3}"/><stop offset="1" stop-color="${m4}"/></linearGradient>
    <linearGradient id="mt2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m3}"/><stop offset=".5" stop-color="${m1}"/><stop offset="1" stop-color="${m2}"/></linearGradient>
    <radialGradient id="dial" cx=".42" cy=".36" r=".8"><stop offset="0" stop-color="${s.dial2}"/><stop offset="1" stop-color="${s.dial}"/></radialGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect x="-200" y="-200" width="1200" height="1200" fill="url(#bg)"/>
  <ellipse cx="412" cy="425" rx="220" ry="224" fill="#000" opacity=".55" filter="url(#soft)"/>
  ${isBracelet ? bracelet() : strap()}
  <g fill="url(#mt)"><path d="M318 262 L306 190 Q322 176 350 186 L366 240 Z"/><path d="M482 262 L494 190 Q478 176 450 186 L434 240 Z"/><path d="M318 538 L306 610 Q322 624 350 614 L366 560 Z"/><path d="M482 538 L494 610 Q478 624 450 614 L434 560 Z"/></g>
  <rect x="${cx + 196}" y="${cy - 25}" width="34" height="50" rx="7" fill="url(#mt)"/>
  ${radialTicks(cx + 213, cy, 0, 0, 0, m4, 0)}
  <path d="M${cx + 204} ${cy - 25}v50M${cx + 212} ${cy - 25}v50M${cx + 220} ${cy - 25}v50" stroke="${m4}" stroke-width="1.4" opacity=".6"/>
  <circle cx="${cx}" cy="${cy}" r="204" fill="url(#mt)"/>
  <circle cx="${cx}" cy="${cy}" r="198" fill="url(#mt2)"/>
  ${bezel}
  <circle cx="${cx}" cy="${cy}" r="${dialR + 2}" fill="${m4}"/>
  <circle cx="${cx}" cy="${cy}" r="${dialR}" fill="url(#dial)"/>
  ${radialTicks(cx, cy, dialR, 8, 180, '#fff', 0.5, 0.05)}
  ${radialTicks(cx, cy, dialR - 3, dialR - 9, 60, text, 1, 0.55)}
  ${indices}
  ${complications}
  ${date}
  <text x="${cx}" y="${cy - dialR + 66}" text-anchor="middle" font-size="16" letter-spacing="3" font-family="Georgia,serif" fill="${text}">HALDEN &amp; VOSS</text>
  <text x="${cx}" y="${cy - dialR + 82}" text-anchor="middle" font-size="8" letter-spacing="3" font-family="Helvetica,Arial,sans-serif" fill="${text}" opacity=".7">GENÈVE</text>
  ${hand(cx, cy, hourDeg, handLen * 0.62, 15, handColor)}
  ${hand(cx, cy, minuteDeg, handLen * 0.96, 11, handColor)}
  ${s.sub === 'chrono' ? '' : `<g transform="translate(${cx} ${cy}) rotate(${second})"><rect x="-1" y="-${handLen + 4}" width="2" height="${handLen + 40}" fill="#c0392b"/></g>`}
  <circle cx="${cx}" cy="${cy}" r="9" fill="${m3}" stroke="${m4}"/><circle cx="${cx}" cy="${cy}" r="3" fill="${m4}"/>
  <path d="M${cx - 150} ${cy - 90} A175 175 0 0 1 ${cx + 40} ${cy - 170} A260 260 0 0 0 ${cx - 150} ${cy - 90} Z" fill="#fff" opacity=".1"/>
  </svg>`;
}

const CAR_BODY = {
  gt: {
    body: 'M86 402 C80 366 106 346 170 332 C232 318 298 302 372 262 C432 230 548 220 628 236 C698 250 760 292 836 306 C886 316 918 338 922 374 C924 396 916 412 900 414 L818 414 A70 70 0 0 0 678 414 L322 414 A70 70 0 0 0 182 414 L104 414 C94 414 88 410 86 402 Z',
    glass: 'M396 268 C446 244 536 236 604 250 C640 258 676 280 706 300 L396 302 Z',
    pillar: 'M552 240 L560 302',
    line: 'M120 356 C300 340 600 336 900 352',
    wheels: [252, 748], wheelR: 60, head: [96, 362], tail: [908, 352], roof: 0,
  },
  roadster: {
    body: 'M84 404 C80 370 110 352 176 340 C248 328 330 322 410 316 C430 296 452 274 474 268 L486 270 C472 284 460 300 452 316 L640 318 C650 306 668 296 700 296 C734 296 760 306 790 314 C862 324 914 340 922 378 C924 398 916 414 900 416 L818 416 A70 70 0 0 0 678 416 L322 416 A70 70 0 0 0 182 416 L102 416 C92 416 86 412 84 404 Z',
    glass: 'M462 316 L484 276 L490 278 L474 316 Z',
    pillar: '',
    line: 'M120 366 C300 352 600 348 900 362',
    wheels: [252, 748], wheelR: 60, head: [94, 368], tail: [908, 360], roof: 1,
  },
  hyper: {
    body: 'M66 410 C62 392 92 376 150 362 C236 342 318 318 398 282 C462 256 556 248 632 262 C704 276 790 300 880 318 C916 326 938 346 936 380 C936 400 926 416 908 418 L826 418 A72 72 0 0 0 682 418 L320 418 A72 72 0 0 0 176 418 L84 418 C74 418 68 416 66 410 Z',
    glass: 'M420 286 C470 264 552 258 616 270 L672 310 L392 318 Z',
    pillar: 'M540 262 L548 314',
    line: 'M170 386 L470 350 L690 362',
    wheels: [248, 754], wheelR: 62, head: [84, 388], tail: [922, 346], roof: 0,
  },
};

function carWheel(cx, cy, r) {
  let spokes = '';
  for (let i = 0; i < 10; i++) {
    spokes += `<path d="M0 0 L-5 ${-r * 0.74} L5 ${-r * 0.74} Z" fill="url(#rim)" transform="translate(${cx} ${cy}) rotate(${i * 36})"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0b0b0c"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="#16161a"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.78}" fill="#101012" stroke="url(#rim)" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.52}" fill="none" stroke="#a23a2b" stroke-width="9" stroke-dasharray="55 200" opacity=".85"/>
  ${spokes}
  <circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="url(#rim)"/>`;
}

function carSvg(s, view) {
  const c = CAR_BODY[s.style] ?? CAR_BODY.gt;
  const y = 416;
  const [h1, h2] = c.head;
  const [t1, t2] = c.tail;
  const views = { front: '0 80 1000 600', wheel: '120 300 280 210', detail: '60 240 420 240', rear: '560 230 420 280' };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${views[view] ?? views.front}" role="img">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26241f"/><stop offset=".7" stop-color="#14130f"/><stop offset="1" stop-color="#0b0a08"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2a25"/><stop offset="1" stop-color="#0d0c0a"/></linearGradient>
    <linearGradient id="paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.paint2}"/><stop offset=".42" stop-color="${s.paint}"/><stop offset=".62" stop-color="${s.paint}"/><stop offset="1" stop-color="#050505"/></linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".32"/><stop offset=".6" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d4752"/><stop offset=".5" stop-color="#0c1014"/><stop offset="1" stop-color="#1c232b"/></linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f2f4"/><stop offset="1" stop-color="#6f7378"/></linearGradient>
    <radialGradient id="spot" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff5dd" stop-opacity=".16"/><stop offset="1" stop-color="#fff5dd" stop-opacity="0"/></radialGradient>
    <filter id="blur" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="12"/></filter>
    <clipPath id="bodyClip"><path d="${c.body}"/></clipPath>
  </defs>
  <rect x="0" y="0" width="1000" height="470" fill="url(#wall)"/>
  <rect x="0" y="470" width="1000" height="260" fill="url(#floor)"/>
  <ellipse cx="500" cy="280" rx="480" ry="240" fill="url(#spot)"/>
  <ellipse cx="500" cy="482" rx="440" ry="24" fill="#000" opacity=".85" filter="url(#blur)"/>
  <g opacity=".12" transform="translate(0 964) scale(1 -1)"><path d="${c.body}" fill="${s.paint2}"/></g>
  <path d="${c.body}" fill="url(#paint)"/>
  <g clip-path="url(#bodyClip)">
    <rect x="60" y="230" width="900" height="120" fill="url(#sheen)"/>
    <rect x="60" y="398" width="900" height="30" fill="#000" opacity=".45"/>
  </g>
  ${c.roof ? '<path d="M488 318 C520 300 600 298 640 318 Z" fill="#c29a6b" opacity=".85"/>' : ''}
  <path d="${c.glass}" fill="url(#glass)" stroke="#000" stroke-width="2"/>
  ${c.pillar ? `<path d="${c.pillar}" stroke="${s.paint}" stroke-width="7"/>` : ''}
  <path d="${c.line}" stroke="#fff" stroke-opacity=".2" stroke-width="2" fill="none"/>
  <path d="M540 330 h44" stroke="#d7d9dc" stroke-width="4" stroke-linecap="round" opacity=".7"/>
  <path d="M${h1} ${h2} q26 -14 62 -14 q-16 18 -54 26 z" fill="#f7f4e6"/>
  <ellipse cx="${h1 + 34}" cy="${h2 - 2}" rx="52" ry="10" fill="#fff6d4" opacity=".28" filter="url(#blur)"/>
  <path d="M${t1} ${t2} q-22 -6 -48 -6 q8 16 44 22 z" fill="#d11e2c"/>
  ${carWheel(c.wheels[0], y, c.wheelR)}
  ${carWheel(c.wheels[1], y, c.wheelR)}
  </svg>`;
}

function accessorySvg(s) {
  const c = s.color;
  const defs = `<defs><radialGradient id="bg" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#efe9dc"/><stop offset="1" stop-color="#c9bfa9"/></radialGradient>
    <linearGradient id="mt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#9ea3a8"/><stop offset="1" stop-color="#e3e5e7"/></linearGradient>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#1a120c"/></linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter></defs>
    <rect width="800" height="800" fill="url(#bg)"/>`;
  const body = {
    winder: `<ellipse cx="400" cy="640" rx="280" ry="24" fill="#000" opacity=".4" filter="url(#soft)"/>
      <rect x="130" y="190" width="540" height="440" rx="20" fill="url(#base)"/>
      <rect x="160" y="220" width="480" height="340" rx="10" fill="#17120e"/>
      ${[280, 520].map((x) => `<circle cx="${x}" cy="390" r="100" fill="#2c231b" stroke="#b08d57" stroke-width="4"/>
        <circle cx="${x}" cy="390" r="66" fill="url(#mt)"/><circle cx="${x}" cy="390" r="54" fill="#14233f"/>
        <path d="M${x} 390 L${x + 28} 356 M${x} 390 L${x - 16} 362" stroke="#efece3" stroke-width="4" stroke-linecap="round"/>`).join('')}
      <rect x="360" y="580" width="80" height="22" rx="4" fill="#b08d57"/>`,
    roll: `<ellipse cx="400" cy="570" rx="280" ry="24" fill="#000" opacity=".35" filter="url(#soft)"/>
      <rect x="130" y="290" width="540" height="270" rx="110" fill="url(#base)"/>
      <ellipse cx="660" cy="425" rx="58" ry="134" fill="#3a2414"/><ellipse cx="660" cy="425" rx="30" ry="84" fill="#1f130a"/>
      <rect x="360" y="282" width="56" height="286" fill="#2e1c0f"/><rect x="372" y="400" width="32" height="44" rx="4" fill="none" stroke="#c9a35f" stroke-width="5"/>
      <path d="M170 318 H630 M170 534 H630" stroke="#fff" stroke-opacity=".28" stroke-width="2" stroke-dasharray="8 7"/>`,
    strap: `<g transform="rotate(35 400 400)"><ellipse cx="420" cy="420" rx="90" ry="340" fill="#000" opacity=".28" filter="url(#soft)"/>
      <path d="M340 70 L460 70 L450 340 L350 340 Z" fill="${c}"/><path d="M350 430 L450 430 L460 650 Q400 740 340 650 Z" fill="${c}"/>
      <path d="M354 80 L362 330 M446 80 L438 330 M362 440 L352 650 M438 440 L448 650" stroke="#fff" stroke-opacity=".4" stroke-width="2" stroke-dasharray="7 6"/>
      ${[470, 520, 570, 620].map((y) => `<circle cx="400" cy="${y}" r="7" fill="#000" opacity=".55"/>`).join('')}
      <rect x="360" y="330" width="80" height="16" fill="url(#mt)" rx="4"/><rect x="340" y="56" width="120" height="16" rx="6" fill="url(#mt)"/></g>`,
    loupe: `<ellipse cx="420" cy="600" rx="220" ry="20" fill="#000" opacity=".35" filter="url(#soft)"/>
      <rect x="520" y="480" width="210" height="44" rx="20" fill="#3a2414" transform="rotate(38 520 480)"/>
      <circle cx="360" cy="360" r="210" fill="${c}"/><circle cx="360" cy="360" r="178" fill="#2d2a25"/><circle cx="360" cy="360" r="160" fill="#d7e1e4"/>
      <circle cx="360" cy="360" r="160" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>
      <path d="M250 300 A130 130 0 0 1 380 220" stroke="#fff" stroke-width="14" fill="none" opacity=".8" stroke-linecap="round"/>
      ${radialTicks(360, 360, 205, 188, 48, '#7c5c20', 3)}`,
    cufflinks: `${[[270, 400], [530, 430]].map(([x, y]) => `<ellipse cx="${x + 10}" cy="${y + 124}" rx="120" ry="16" fill="#000" opacity=".35" filter="url(#soft)"/>
      <circle cx="${x}" cy="${y}" r="104" fill="url(#mt)"/>${radialTicks(x, y, 104, 122, 24, '#9ea3a8', 12)}
      <circle cx="${x}" cy="${y}" r="74" fill="#d9dce0"/><circle cx="${x}" cy="${y}" r="24" fill="url(#mt)"/>
      ${radialTicks(x, y, 28, 72, 5, '#9ea3a8', 9)}`).join('')}`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img">${defs}${body[s.kind] ?? ''}</svg>`;
}

export function renderProductImage(spec, view = 'front') {
  if (spec.type === 'watch') return watchSvg(spec, view);
  if (spec.type === 'car') return carSvg(spec, view);
  return accessorySvg(spec);
}

export function placeholderImage() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="#1c1a17"/><circle cx="400" cy="400" r="120" fill="none" stroke="#b08d57" stroke-width="3"/><text x="400" y="412" text-anchor="middle" fill="#b08d57" font-family="Georgia,serif" font-size="34">H&amp;V</text></svg>`;
}
