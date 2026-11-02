// Generates LAB_GUIDE.md and VIVA_QUESTIONS.md from the single source of truth
// in server/content/labs.js, so the written guides never drift from the app.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../server/config.js';
import { LABS, GLOSSARY } from '../server/content/labs.js';

const list = (arr) => arr.map((x) => `- ${x}`).join('\n');
const steps = (arr) => arr.map((x, i) => `${i + 1}. ${x}`).join('\n');

function labGuide() {
  const out = ['# Lab Guide — Halden & Voss Security Laboratory', '',
    'Step-by-step instructions for every laboratory. Generated from the application content, so it matches the in-app Security Lab exactly.',
    '', 'All exercises run locally against `http://127.0.0.1:4000`. Switch modes from **Security Lab → Control centre**.', '',
    '## Contents', '', ...LABS.map((l) => `${l.number}. [${l.title}](#lab-${l.number}-${l.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}) — ${l.practical}`), ''];

  for (const l of LABS) {
    out.push(`---`, '', `## Lab ${l.number}: ${l.title}`, '', `*${l.practical}*`, '',
      `**Objective.** ${l.objective}`, '',
      `**What is it?** ${l.what}`, '',
      `**How it works.** ${l.how}`, '',
      `**Why it happens.** ${l.why}`, '',
      `### Prerequisites`, '', list(l.prerequisites), '',
      `### Step by step`, '', steps(l.steps), '',
      `### Expected result`, '', list(l.expected), '',
      `### What to watch in DevTools`, '', list(l.devtools), '',
      `### Evidence to capture`, '', list(l.evidence), '');
    if (l.safety) out.push(`### Safety`, '', l.safety, '');
    if (l.hints) out.push(`### Hints`, '', list(l.hints), '');
    out.push(`### How to fix it`, '', list(l.fix), '',
      `### How secure mode behaves`, '', l.secureBehaviour, '');
  }
  return out.join('\n');
}

function vivaDoc() {
  const out = ['# Viva Questions — Halden & Voss Security Laboratory', '',
    'Spoken-ready answers for the oral examination, grouped by laboratory. Generated from the application content.', ''];
  for (const l of LABS) {
    out.push(`## Lab ${l.number}: ${l.title}`, '');
    l.viva.forEach((v, i) => out.push(`**Q${i + 1}. ${v.q}**`, '', v.a, ''));
  }
  out.push('## Glossary quick reference', '');
  for (const [term, def] of GLOSSARY) out.push(`**${term}.** ${def}`, '');
  return out.join('\n');
}

fs.writeFileSync(path.join(ROOT, 'LAB_GUIDE.md'), labGuide());
fs.writeFileSync(path.join(ROOT, 'VIVA_QUESTIONS.md'), vivaDoc());
console.log('Wrote LAB_GUIDE.md and VIVA_QUESTIONS.md from server/content/labs.js');
