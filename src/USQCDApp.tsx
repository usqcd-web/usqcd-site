import React, { useEffect, useState } from 'react';
import FiguresCarousel from "./components/FiguresCarousel";
import Software  from "./components/Software.tsx";

const base = import.meta.env.BASE_URL || "/";

// helper to safely resolve paths that may contain a literal "${base}" or be relative
function resolvePath(p: string | undefined) {
  if (!p) return `${base}`;
  // if caller left literal ${base} in the string, replace it
  if (p.includes("${base}")) {
    p = p.replace(/\$\{base\}/g, base);
  }
  // absolute URL -> return as-is
  if (/^https?:\/\//i.test(p)) return p;
  // if already starts with runtime base, return as-is
  if (base && p.startsWith(base)) return p;
  // strip leading slashes and prefix base
  const cleaned = p.replace(/^\/+/, "");
  return `${base}${cleaned}`;
}

// Single-file preview app for USQCD (React + Tailwind). This file is a complete, syntactically-correct
// React component intended for use in the canvas preview. It includes the main sections used in the
// project: header, carousel, science, thrusts, publications (loads static then API), resources,
// collaboration, meetings archive and contact. All JSX elements are properly closed to avoid
// unterminated JSX errors.

const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'science', label: 'Science' },
  { id: 'publications', label: 'Publications' },
  { id: 'resources', label: 'Resources' },
  { id: 'software', label: 'Software' },
  { id: 'collaboration', label: 'Collaboration' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'contact', label: 'Contact' }
];

const HERO_SLIDES = [
  { src: 'https://edryd.org/wp-content/uploads/2019/11/lattice-qcd-visualization.png', alt: 'Lattice QCD visualization', credit: 'Community visualization' },
  { src: 'https://www.alcf.anl.gov/sites/all/themes/alcf/images/aurora-hero.jpg', alt: 'Leadership supercomputer (ALCF)', credit: 'ALCF / Argonne' },
  { src: 'https://www.bu.edu/tech/wp-content/uploads/sites/88/2016/01/lattice_qcd_2005.jpg', alt: 'Topological charge visualization', credit: 'Community' }
];

function IconExternal() {
  return (
    <svg className="w-4 h-4 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m3-3h5v5M10 14L21 3" />
    </svg>
  );
}

function Logo() {
  // Inline vector logo: grid background + bold blue USQCD
  return (

      <svg
        width="320"
        height="115"
        viewBox="0 0 360 115"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="USQCD logo"
        className="block"
      >
        <defs>
          <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="#fff" />
            <path d="M12 0H0V12" fill="none" stroke="#b6b6b6" strokeWidth="2"/>
          </pattern>
          <linearGradient id="bgGrad" x1="0" x2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#fbfbfd" />
          </linearGradient>
        </defs>

        {/* background rounded rect filled with grid */}
        <rect x="0" y="0" width="340" height="125" rx="8" ry="8" fill="url(#bgGrad)" />
        <rect x="11" y="12" width="318" height="97" rx="4" ry="4" fill="url(#grid)" />

        {/* subtle border */}
        <rect x="0.5" y="0.5" width="340" height="124" rx="8" ry="8" fill="none" stroke="#d9d9d9" strokeWidth="1"/>

        {/* USQCD text — solid vector text (will render as text but remains vector) */}
        <g transform="translate(18,66)">
          <text
            x="0"
            y="25"
            fontFamily="Inter, Arial, Helvetica, sans-serif"
            fontWeight="700"
            fontSize="84"
            fill="#0B57A6"
            letterSpacing="-2"
          >
            USQCD
          </text>
        </g>
      </svg>

  );
}


function Header({ active, setActive }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-white/60 border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-6">
        <Logo />
        <nav className="ml-6 hidden lg:flex gap-4 items-center">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setActive(n.id)} className={`text-sm font-medium py-2 px-3 rounded-md ${active === n.id ? 'text-sky-700 bg-sky-50' : 'text-slate-600 hover:bg-slate-50'}`}>
              {n.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}


function SectionShell({ title, children }) {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">{title}</h2>
        <div className="prose prose-slate">{children}</div>
      </div>
    </section>
  );
}

function Thrusts() {
  const [images, setImages] = useState({});
  useEffect(() => {
    fetch('/api/publications').then((r) => r.ok ? r.json() : {}).then((j) => setImages(j?.thrust_images || {})).catch(() => setImages({}));
  }, []);

  const fallbackImages = {
    'nucleon-structure': 'https://edryd.org/wp-content/uploads/2019/11/lattice-qcd-visualization.png',
    'spectroscopy': 'https://www.bu.edu/tech/wp-content/uploads/sites/88/2016/01/lattice_qcd_2005.jpg',
    'nuclei': 'https://www.alcf.anl.gov/sites/all/themes/alcf/images/aurora-hero.jpg',
    'muon-g2': 'https://ar5iv.org/static/ar5iv-PDFs/2411.09656.pdf.cover.jpg',
    'flavor-ckm': 'https://edryd.org/wp-content/uploads/2019/11/lattice-qcd-visualization.png'
  };

  const THRUSTS = [
    { key: 'nucleon-structure', title: 'Nucleon structure', desc: 'Axial charge, radii, form factors.' },
    { key: 'spectroscopy', title: 'Spectroscopy', desc: 'Resonances, exotics, finite-volume amplitudes.' },
    { key: 'nuclei', title: 'Nuclear inputs', desc: 'Magnetic moments & polarizabilities.' },
    { key: 'muon-g2', title: 'Muon g-2', desc: 'HVP & HLbL window contributions.' },
    { key: 'flavor-ckm', title: 'Flavor & CKM', desc: 'Decay constants & mixing matrix elements.' },
    { key: 'algorithms', title: 'Algorithms', desc: 'Algorithms for lattice field theory.' },
    { key: 'quantum', title: 'Quantum Computing', desc: 'Lattice field theory on quantum devices.' }

  ];

  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">Science thrusts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {THRUSTS.map((t) => (
            <div key={t.key} className="relative rounded-2xl overflow-hidden shadow-sm bg-slate-50">
              <div className="relative h-56 w-full">
                {(images && images[t.key]) || fallbackImages[t.key] ? (
                  <>
                    <img src={images[t.key] || fallbackImages[t.key]} alt={t.title} className="w-full h-56 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/25 to-sky-600/20 mix-blend-multiply pointer-events-none" />
                    <div className="absolute left-4 bottom-4 bg-white/90 text-slate-800 px-3 py-1 rounded-md text-sm font-medium">{t.title}</div>
                    <div className="absolute right-3 top-3 text-xs text-white/80 font-medium">USQCD</div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">No image</div>
                )}
              </div>
              <div className="p-4">
                <div className="font-semibold text-slate-900">{t.title}</div>
                <div className="text-sm text-slate-600 mt-1">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScienceSection() {
  const whitePapers = [
    { title: 'Hadrons and Nuclei', link: 'https://inspirehep.net/literature/1730506' },
    { title: 'Hot-dense QCD', link: 'https://inspirehep.net/literature/1730501' },
    { title: 'Flavor Physics', link: 'https://inspirehep.net/literature/1730491' },
    { title: 'Neutrino-Nucleus Scattering', link: 'https://inspirehep.net/literature/1730504' },
    { title: 'Symmetries & BSM', link: 'https://inspirehep.net/literature/1730510' },
    { title: 'Lattice BSM', link: 'https://inspirehep.net/literature/1730601' },
    { title: 'Exascale & Computing', link: 'https://inspirehep.net/literature/1730494' },
    { title: 'Lattice QCD and Particle Physics', link: 'https://arxiv.org/abs/2207.07641'}
  ];

  return (
    <SectionShell title="Science highlights & background">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="max-w-6xl mx-auto px-6 py-12">
       	      <FiguresCarousel jsonPath={resolvePath('static/data/doe-science.json')} interval={7000} maxCaptionWords={30} maxImageHeight={300} />
      	</div>
{/*
        <div>
          <h3>Precision flavor physics</h3>
          <p>Decay constants, semileptonic form factors, and neutral-meson mixing matrix elements computed with lattice QCD feed directly into CKM determinations and tests of the Standard Model.</p>

          <h3 className="mt-6">Hadron spectroscopy</h3>
          <p>Finite-volume methods allow extraction of resonance properties and excited-state spectra — including hybrid and exotic candidates.</p>

          <h3 className="mt-6">Muon g-2 contributions</h3>
          <p>Lattice calculations of hadronic vacuum polarization and hadronic light-by-light contributions are essential for the Standard-Model prediction of the muon anomalous magnetic moment.</p>
        </div>
*/}
        <aside>
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-semibold">USQCD white papers</h4>
            <p className="text-sm text-slate-600">Core background documents collected by USQCD; click to open the canonical INSPIRE entries.</p>
            <ul className="mt-3 space-y-2">
              {whitePapers.map((wp) => (
                <li key={wp.link}>
                  <a className="text-sky-600 font-medium" href={wp.link} target="_blank" rel="noreferrer">{wp.title} <IconExternal /></a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <Thrusts />
    </SectionShell>
  );
}



/* Helper: produce list of years from start (2001) to current year */
function yearList(start = 2001) {
  const now = new Date();
  const cy = now.getFullYear();
  const years = [];
  for (let y = cy; y >= start; --y) years.push(y);
  return years;
}


/* ====== REPLACED PublicationsIndex and YearPublications ====== */

/* Helper: compute counts by checking journal_ref and title fields */
function computeJournalSummaryFromPubs(pubs = []) {
  const summary = {
    total: pubs.length || 0,
    PRL: 0,
    PRC: 0,
    PRD: 0,
    PRX: 0,
    NPB: 0,
    PLB: 0,
    EPJ: 0,
    JPG: 0,
    Science: 0,
    Nature: 0,
    POS: 0,
    citations: 0
  };

  if (!Array.isArray(pubs)) return summary;

  const check = (str, re) => {
    if (!str) return false;
    return re.test(str);
  };

  const rePRL = /\b(PRL|Phys\.?\s*Rev\.?\s*Lett\.?|Physical\s+Review\s+Letters?)\b/i;
  const rePRC = /\b(PRC|Phys\.?\s*Rev\.?\s*C|Physical\s+Review\s+C)\b/i;
  const rePRD = /\b(PRD|Phys\.?\s*Rev\.?\s*D|Physical\s+Review\s+D)\b/i;
  const rePRX = /\b(PRX|Phys\.?\s*Rev\.?\s*X|Physical\s+Review\s+X)\b/i;
  const reNPB = /\b(NPB|Nucl\.?\s*Phys\.?\s*B|Nuclear\s+Physics\s+B)\b/i;
  const rePLB = /\b(PLB|Phys\.?\s*Lett\.?\s*B|Physics\s+Letters\s+B)\b/i;
  const reJPG = /\b(JPG|Jour\.?\s*Phys\.?\s*|Journal\s+of\s+LetterPhysics)\b/i;
  const rePOS = /\b(POS)\b/i;
  const reEPJ = /\b(EPJ|Eur\.?\s*Phys\.?\s*J|European\s+Physics\s+Journal)\b/i;
  const reScience = /\b(Science|Science\.)\b/i;
  const reNature = /\b(Nature|Nature\.)\b/i;

  pubs.forEach((p) => {
    const jref = (p.inspire && p.inspire.journal_ref) ? (p.inspire.journal_ref + "") : ((p.journal_ref || "") + "");
    const title = (p.title || "") + "";

    const hay = (jref + " " + title).trim();

    if (check(hay, rePRL)) summary.PRL += 1;
    if (check(hay, rePRC)) summary.PRC += 1;
    if (check(hay, rePRD)) summary.PRD += 1;
    if (check(hay, rePRX)) summary.PRX += 1;
    if (check(hay, reNPB)) summary.NPB += 1;
    if (check(hay, rePLB)) summary.PLB += 1;
    if (check(hay, reEPJ)) summary.EPJ += 1;
    if (check(hay, reJPG)) summary.JPG += 1;
    if (check(hay, rePOS)) summary.POS += 1;
    if (check(hay, reScience)) summary.Science += 1;
    if (check(hay, reNature)) summary.Nature += 1;

    // --- Citation accumulation (defensive) ---
    let c = null;
    if (typeof p.citation_count === 'number') c = p.citation_count;
    else if (p.inspire && typeof p.inspire.citation_count === 'number') c = p.inspire.citation_count;
    else if (typeof p.citations === 'number') c = p.citations;
    try {
      if (p.inspire && p.inspire.metrics && typeof p.inspire.metrics.citation_count === 'number') {
        c = p.inspire.metrics.citation_count;
      }
    } catch (e) { /* ignore */ }
    if (c == null && p.metrics && typeof p.metrics.citation_count === 'number') {
      c = p.metrics.citation_count;
    }
    if (c == null && typeof p.citation_count === 'string' && p.citation_count.match(/^\d+$/)) {
      c = parseInt(p.citation_count, 10);
    }
    if (c != null && !Number.isNaN(Number(c))) {
      summary.citations += Number(c);
    }
  });

  return summary;
}

/* YearPublications: loads per-year JSON or API (for current year) and displays breakdown */
function YearPublications({ year }) {
  const [pubs, setPubs] = React.useState(null);
  const [meta, setMeta] = React.useState(null);
  const [summary, setSummary] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      const now = new Date();
      const currentYear = now.getFullYear();

      // Try API for current year first (fresh), then static fallback
      if (year === currentYear) {
        try {
          const r = await fetch(`${base}api/publications?year=${year}`);
          if (r.ok) {
            const j = await r.json();
            if (mounted) {
              const pubsArr = j.publications || [];
              setPubs(pubsArr);
              setMeta({ generated: j.generated || new Date().toISOString(), count: j.count || pubsArr.length, source: 'api' });
              setSummary(computeJournalSummaryFromPubs(pubsArr));
              return;
            }
          }
        } catch (e) {
          // fallback to static
        }
      }

      // Load static cached file
      try {
        const r2 = await fetch(resolvePath(`static/data/publications-${year}.json`));
        if (r2.ok) {
          const j2 = await r2.json();
          if (mounted) {
            const pubsArr = j2.publications || [];
            setPubs(pubsArr);
            setMeta({ generated: j2.generated || new Date().toISOString(), count: j2.count || pubsArr.length, source: 'static' });
            setSummary(computeJournalSummaryFromPubs(pubsArr));
            return;
          }
        } else {
          if (mounted) {
            setPubs([]);
            setMeta({ generated: null, count: 0, source: 'none' });
            setSummary(computeJournalSummaryFromPubs([]));
          }
        }
      } catch (e) {
        if (mounted) {
          setPubs([]);
          setMeta({ generated: null, count: 0, source: 'error' });
          setSummary(computeJournalSummaryFromPubs([]));
        }
      }
    }
    load();
    return () => { mounted = false; };
  }, [year]);

  if (pubs === null) return <div className="p-4 text-sm text-slate-500">Loading publications for {year}…</div>;

  return (
    <div className="mt-4">
      <div className="mb-3 text-xs text-slate-400">
        {meta && meta.generated ? `Data generated: ${meta.generated}` : 'No generation timestamp'} • source: {meta?.source || 'unknown'}
      </div>

      {/* Summary box */}
      <div className="p-4 mb-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Year summary — {year}</div>
            <div className="text-xs text-slate-600">Total papers: <span className="font-medium">{summary?.total ?? 0}</span></div>
	    <div className="text-xs text-slate-600">Citations (total): <span className="font-medium">{summary?.citations ?? 0}</span></div>
          </div>
          <div className="text-xs text-slate-600">
            <div>PRL: <span className="font-medium">{summary?.PRL ?? 0}</span></div>
            <div>PRX: <span className="font-medium">{summary?.PRX ?? 0}</span></div>
            <div>NPB: <span className="font-medium">{summary?.NPB ?? 0}</span></div>
            <div>PLB: <span className="font-medium">{summary?.PLB ?? 0}</span></div>
            <div>PoS: <span className="font-medium">{summary?.POS ?? 0}</span></div>
          </div>
          <div className="text-xs text-slate-600">
            <div>PRC: <span className="font-medium">{summary?.PRC ?? 0}</span></div>
            <div>PRD: <span className="font-medium">{summary?.PRD ?? 0}</span></div>
            <div>EPJ: <span className="font-medium">{summary?.EPJ ?? 0}</span></div>
            <div>Science: <span className="font-medium">{summary?.Science ?? 0}</span></div>
            <div>Nature: <span className="font-medium">{summary?.Nature ?? 0}</span></div>
          </div>
        </div>
      </div>

      {pubs.length === 0 ? (
        <div className="p-4 bg-slate-50 rounded-md text-slate-600">No publications found for {year}.</div>
      ) : (
        <div className="space-y-4">
          {pubs.map((p) => (
            <article key={p.id || p.link} className="p-4 bg-white border border-slate-100 rounded-lg shadow-sm">
              <a href={p.link || p.pdf || '#'} target="_blank" rel="noreferrer" className="text-sky-600 font-semibold text-lg">{p.title}</a>
              <div className="text-sm text-slate-500 mt-1">{(p.authors || []).slice(0, 8).join(', ')}{(p.authors || []).length > 8 ? '…' : ''}</div>
              <p className="text-sm text-slate-700 mt-3">{p.summary || ''}</p>
              <div className="mt-3 text-xs text-slate-400">{p.pdf ? <a href={p.pdf} target="_blank" rel="noreferrer">PDF</a> : null} {p.id ? <span> • arXiv:{p.id}</span> : null}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}


/* ===== Replaced PublicationsIndex: shows per-year summaries under the Year archive buttons ===== */
function PublicationsIndex() {
  const [recent, setRecent] = React.useState([]);
  const [meta, setMeta] = React.useState(null);
  const [selectedYear, setSelectedYear] = React.useState(null);
  const [yearSummaries, setYearSummaries] = React.useState({}); // { year: { total, PRL, ... , citations } }
  const [allTotals, setAllTotals] = React.useState({ total: 0, citations: 0 });

  React.useEffect(() => {
    let mounted = true;
    async function loadRecent() {
      // prefer static bundle for preview
      try {
        const s = await fetch(resolvePath('static/data/publications.json'));
        if (s.ok) {
          const j = await s.json();
          if (mounted && j && j.publications) {
            setRecent(j.publications.slice(0, 5));
            setMeta({ generated: j.generated, count: j.count, source: 'static' });
            return;
          }
        }
      } catch (e) {}
      // fallback API
      try {
        const r = await fetch(resolvePath('api/publications?limit=5'));
        if (r.ok) {
          const j = await r.json();
          if (mounted && j && j.publications) {
            setRecent(j.publications.slice(0, 5));
            setMeta({ generated: j.generated, count: j.count, source: 'api' });
            return;
          }
        }
      } catch (e) {}
      if (mounted) { setRecent([]); setMeta({ generated: null, count: 0, source: 'none' }); }
    }
    loadRecent();
    return () => { mounted = false; };
  }, []);

  /* Preload short per-year totals for sidebar badges.
     NOTE: this will attempt to fetch static/data/publications-YYYY.json for every year.
     If you prefer lazy-loading, we can change to fetch only on hover/click. */
  React.useEffect(() => {
    let mounted = true;
    const years = yearList(2001);
    async function loadSummaries() {
      const results = {};
      const currentYear = new Date().getFullYear();

      for (const y of years) {
        try {
          // prefer static file for archived years; for current year try API then static
          let data = null;
          if (y === currentYear) {
            try {
              const r = await fetch(resolvePath(`api/publications?year=${y}`));
              if (r.ok) data = await r.json();
            } catch (e) { /* ignore */ }
          }
          if (!data) {
            const r2 = await fetch(resolvePath(`static/data/publications-${y}.json`));
            if (r2.ok) data = await r2.json();
          }
          const pubs = (data && data.publications) ? data.publications : [];
          results[y] = computeJournalSummaryFromPubs(pubs);
        } catch (e) {
          results[y] = { total: 0, PRL:0, PRD:0, NPB:0, PLB:0, EPJ:0, Science:0, Nature:0, citations: 0 };
        }
        // polite pause to avoid hammering if many years (tiny gap)
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, 60));
      }

      if (mounted) {
        setYearSummaries(results);

        // compute overall totals across all years we just loaded
        const totals = Object.values(results).reduce(
          (acc, s) => {
            acc.total += (s?.total || 0);
            acc.citations += (s?.citations || 0);
            return acc;
          },
          { total: 0, citations: 0 }
        );
        setAllTotals(totals);
      }
    }

    loadSummaries();
    return () => { mounted = false; };
  }, []);

  const years = yearList(2001);
  const currentYear = new Date().getFullYear();

  return (
    <SectionShell title="Publications (arXiv feed)">
      <div className="mb-4 text-sm text-slate-500">
        Showing the <strong>5 most recent</strong> USQCD-related hep-lat arXiv submissions. Use the year links to browse the archive (from {currentYear} → 2001).
      </div>

      {meta && <div className="text-xs text-slate-400 mb-4">Feed generated: {meta.generated || '—'} • source: {meta.source}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {recent.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-md text-slate-600">No recent publications available.</div>
            ) : (
              recent.map((p) => (
                <article key={p.id || p.link} className="p-4 bg-white border border-slate-100 rounded-lg shadow-sm">
                  <a href={p.link || p.pdf || '#'} target="_blank" rel="noreferrer" className="text-sky-600 font-semibold text-lg">{p.title}</a>
                  <div className="text-sm text-slate-500 mt-1">{(p.authors || []).slice(0,6).join(', ')}{(p.authors||[]).length>6 ? '…' : ''}</div>
                  <p className="text-sm text-slate-700 mt-3 line-clamp-3">{p.summary || ''}</p>
                  <div className="mt-3 text-xs text-slate-400">{p.pdf ? <a href={p.pdf} target="_blank" rel="noreferrer">PDF</a> : null} {p.id ? <span> • arXiv:{p.id}</span> : null}</div>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-semibold mb-2">Year archive</h4>

          {/* Year buttons */}
          <div className="grid grid-cols-3 gap-2 text-sm leading-tight">
            {years.map((y) => {
              const s = yearSummaries[y];
              return (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`text-left px-2 py-1 rounded flex justify-between items-center ${selectedYear === y ? 'bg-sky-100 text-sky-700' : 'hover:bg-slate-100'}`}
                >
                  <span>{y}</span>
                  <span className="ml-2 text-xs bg-white px-2 py-0.5 rounded-full border text-slate-700">{s ? s.total : '—'}</span>
                </button>
              );
            })}
          </div>


          {/* ===== New: All-year summaries displayed under the year grid ===== */}
          <div className="mt-4">
            <div className="font-medium text-sm mb-2">All-year summaries</div>
            <div className="text-xs text-slate-600 mb-2">Per-year totals (publications • citations). Click a year above to view full list.</div>

            <div className="overflow-y-auto max-h-56 border rounded-md bg-white p-2">
              {/* Header row */}
              <div className="hidden md:flex text-xs text-slate-500 px-2 py-1 font-medium border-b">
                <div className="w-20">Year</div>
                <div className="flex-1">Publications</div>
                <div className="w-24 text-right">Citations</div>
              </div>

              {/* List rows (mobile-friendly stacked layout) */}
              {years.map((y) => {
                const s = yearSummaries[y];
                return (
                  <div key={`sum-${y}`} className="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-0 px-2 py-2 border-b last:border-b-0">
                    <div className="w-20 font-mono text-sm text-slate-700">{y}</div>
                    <div className="flex-1 text-sm text-slate-700">{s ? s.total : '—'}</div>
                    <div className="w-24 text-right text-sm text-slate-600">{s ? s.citations : '—'}</div>
                  </div>
                );
              })}
            </div>

            {/* small all-totals box for convenience */}
            <div className="mt-3 p-3 bg-white rounded border border-slate-100 text-sm">
              <div className="font-medium">All-years totals:</div>
              <div className="text-xs text-slate-600">Publications: <span className="font-medium">{allTotals.total}</span></div>
              <div className="text-xs text-slate-600">Citations: <span className="font-medium">{allTotals.citations}</span></div>
	      <div className="text-[0.5rem] text-slate-450">arXiv search: author ∈  USQCD_members AND category=hep-lat.</div>
            </div>
          </div>
          {/* ===== end new summaries block ===== */}
        </aside>
      </div>

      <div className="mt-8">
        {selectedYear ? <YearPublications year={selectedYear} /> : <div className="text-sm text-slate-500">Select a year to view all USQCD-author hep-lat papers for that year.</div>}
      </div>
    </SectionShell>
  );
}









/* YearPublications: loads static per-year JSON, but for the current year will try the API first */
function PublicationsSection() {
  return <PublicationsIndex />;
}


function MeetingsPage() {
  const [allHands, setAllHands] = React.useState(null);
  const [latticeConfs, setLatticeConfs] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  // Try to load static JSON files; if missing, fall back to embedded defaults.
  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [r1, r2] = await Promise.allSettled([
          fetch(resolvePath('static/data/all-hands.json')),
          fetch(resolvePath('static/data/lattice-conf.json'))
        ]);

        if (mounted) {
          if (r1.status === 'fulfilled' && r1.value.ok) {
            const j = await r1.value.json();
            setAllHands(j.all_hands || []);
          } else {
            // fallback: embedded defaults (kept small — full authoritative list should come from JSON)
            setAllHands([
              { title: 'MIT, 2022', href: 'https://indico.mit.edu' },
              { title: 'MIT, 2021', href: 'https://indico.mit.edu' },
              { title: 'JLab, 2020', href: 'https://indico.jlab.org' }
            ]);
          }

          if (r2.status === 'fulfilled' && r2.value.ok) {
            const j2 = await r2.value.json();
            setLatticeConfs(j2.lattice_conferences || []);
          } else {
            setLatticeConfs([
              { title: 'Lattice 2023 (Fermilab)', href: 'https://www.physics.adelaide.edu.au' },
              { title: 'Lattice 2022 (Bonn)', href: 'https://indico.hiskp.uni-bonn.de' }
            ]);
          }
        }
      } catch (e) {
        if (mounted) {
          setAllHands([]);
          setLatticeConfs([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const renderList = (items) => {
    if (!items) return <div className="text-sm text-slate-500">Loading…</div>;
    if (items.length === 0) return <div className="text-sm text-slate-500">No archived meetings available.</div>;
    return (
      <ul className="space-y-2 list-disc pl-5">
        {items.map((it, i) => (
          <li key={i} className="text-sm">
            {it.href ? (
              <a href={it.href} target="_blank" rel="noreferrer" className="text-sky-600">{it.title}, {it.location} <IconExternal /></a>
            ) : (
              <span className="text-slate-700">{it.title}, {it.location}</span>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <SectionShell title="Meetings & Events — archives">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-semibold text-lg">USQCD all-hands meetings (archive)</h4>
          <p className="text-sm text-slate-600">Direct links to historic USQCD all-hands meetings (indico / local pages). Where an authoritative page was not listed on the USQCD links page, we show the institution landing page or leave the entry unlinked.</p>
          <div className="mt-3">{renderList(allHands)}</div>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-semibold text-lg">Lattice conferences & proceedings (archive)</h4>
          <p className="text-sm text-slate-600">Links for past Lattice conferences and proceedings maintained for reference.</p>
          <div className="mt-3">{renderList(latticeConfs)}</div>
        </div>
      </div>

    </SectionShell>
  );
}



function ResourcesSection() {
  const resources = {
    lgt4hep: 'https://lgt4hep.github.io',
    scidacLQCD1: 'https://lqcdscidac.github.io/index.html',
    scidacLQCD2: 'https://github.com/Scidac5usqcd/MultiscaleAcceleration/wiki',
    exascale: 'https://www.exascaleproject.org/research-project/latticeqcd/'
  };

  return (
    <SectionShell title="Computing, training & community resources">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-semibold">Leadership computing</h4>
          <p className="text-sm text-slate-600">ALCF, OLCF and NERSC INCITE allocations support ensemble generation and large-scale workflows for lattice QCD.</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-semibold">Software stack</h4>
          <p className="text-sm text-slate-600">Chroma, MILC, QLUA, Grid, QUDA and other community codes support production workflows and analysis.</p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => setActive('software')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-cyan-400 to-sky-600 text-white"
            >
              View software
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-semibold">Data & reproducibility</h4>
          <p className="text-sm text-slate-600">Shared data formats and community conventions help teams reproduce and extend lattice calculations across collaborations.</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg md:col-span-2">
          <h4 className="font-semibold">LGT4HEP traineeship program</h4>
          <p className="text-sm text-slate-600">The LGT4HEP traineeship program trains students and early-career researchers in lattice field theory, numerical methods, and modern computing relevant to HEP and nuclear physics.</p>
          <a className="text-sky-600 font-medium" href={resources.lgt4hep} target="_blank" rel="noreferrer">Visit LGT4HEP <IconExternal /></a>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-semibold">SciDAC: LQCD Software & Coordination</h4>
          <p className="text-sm text-slate-600">The NP-ASCR SciDAC LQCD project brings together US groups to develop software, middleware, and workforce training for lattice QCD at scale.</p>
          <a className="text-sky-600" href={resources.scidacLQCD1} target="_blank" rel="noreferrer">LQCD SciDAC project <IconExternal /></a>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-semibold">SciDAC: Multiscale Acceleration (USQCD)</h4>
          <p className="text-sm text-slate-600">HEP-ASCR SciDAC focuses on algorithmic acceleration and multiscale methods for lattice field theory.</p>
          <a className="text-sky-600" href={resources.scidacLQCD2} target="_blank" rel="noreferrer">MultiscaleAcceleration wiki <IconExternal /></a>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-semibold">Exascale Lattice QCD project</h4>
          <p className="text-sm text-slate-600">An Exascale Computing Project (ECP) effort coordinates lattice QCD research to exploit exascale architectures.</p>
          <a className="text-sky-600" href={resources.exascale} target="_blank" rel="noreferrer">Exascale Lattice QCD project <IconExternal /></a>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg md:col-span-3">
          <h4 className="font-semibold">USQCD computing facilities</h4>
          <p className="text-sm text-slate-600">USQCD hosts computing hardware and storage at three U.S. laboratories supporting lattice QCD production and analysis:</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><strong>Jefferson Lab (JLab):</strong> <a className="text-sky-600" href="https://lqcd.jlab.org/lqcd/home" target="_blank" rel="noreferrer">lqcd.jlab.org</a></li>
            <li><strong>Fermilab (FNAL):</strong> <a className="text-sky-600" href="https://computing.fnal.gov/lqcd/" target="_blank" rel="noreferrer">computing.fnal.gov/lqcd</a></li>
            <li><strong>Brookhaven (BNL):</strong> <a className="text-sky-600" href="https://www.sdcc.bnl.gov" target="_blank" rel="noreferrer">sdcc.bnl.gov</a></li>
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}


function useCommittees() {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch(resolvePath('static/data/committees.json'));
        if (!r.ok) throw new Error('failed to load committees');
        const j = await r.json();
        if (mounted) setData(j);
      } catch (e) {
        console.error('Failed to load committees.json', e);
        if (mounted) setData({ executive_committee: [], scientific_program_committee: [] });
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  return data;
}

function ExecCommittee() {
  const committees = useCommittees();
  if (!committees) return <div className="text-sm text-slate-500">Loading Executive Committee…</div>;

  const members = committees.executive_committee || [];

  return (
    <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
      {members.map((m, i) => (
        <li key={i}>
          <strong>{m.role}:</strong> {m.name}
        </li>
      ))}
    </ul>
  );
}

function ScientificProgramCommittee() {
  const committees = useCommittees();
  if (!committees) return <div className="text-sm text-slate-500">Loading Scientific Program Committee…</div>;

  const members = committees.scientific_program_committee || [];

  return (
    <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
      {members.map((m, i) => (
        <li key={i}>
          <strong>{m.role}:</strong> {m.name}
        </li>
      ))}
    </ul>
  );
}

// MembersList reads static JSON (or falls back to a small bundled list for preview)
function MembersList() {
  const [members, setMembers] = useState(null);
  useEffect(() => {
    let mounted = true;
    const tryPaths = [resolvePath('static/data/members.json')];
    async function load() {
      for (const p of tryPaths) {
        try {
          const r = await fetch(p);
          if (!r.ok) continue;
          const j = await r.json();
          if (mounted) { setMembers(j); return; }
        } catch (e) {
          // ignore
        }
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (members === null) return <div className="p-4 text-sm text-slate-500">Loading membership list…</div>;
  if (!members || members.length === 0) return <div className="p-4 text-sm text-slate-500">No membership data found.</div>;

  return (
    <div className="mt-4">
      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Institution</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-3 align-top text-slate-700">{m.name}</td>
                <td className="px-4 py-3 align-top font-medium text-slate-800">{m.institution}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}



function CollaborationPage({ setActive }) {
  const collLinks = {
    members: 'https://www.usqcd.org/members.html',
    charter: 'https://www.usqcd.org/documents/usqcd_charter.pdf',
    codeOfConduct: 'https://www.usqcd.org/documents/code.pdf',
    meetings: 'https://www.usqcd.org/meetings.html'
  };

  return (
    <SectionShell title="Collaboration & Governance">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <p>The USQCD Collaboration coordinates lattice QCD activities across U.S. institutions. Below are the core collaboration resources and how to get involved.</p>

          <div className="p-4 bg-slate-50 rounded-md">
            <h4 className="font-semibold">Collaboration charter</h4>
            <p className="text-sm text-slate-600">Governance structure, membership rules, and the organization of the USQCD collaboration.</p>
            <a className="text-sky-600" href={collLinks.charter} target="_blank" rel="noreferrer">Download charter <IconExternal /></a>
          </div>

          <div className="p-4 bg-slate-50 rounded-md">
            <h4 className="font-semibold">Code of Conduct</h4>
            <p className="text-sm text-slate-600">Community standards and expectations for professional conduct within the USQCD collaboration.</p>
            <a className="text-sky-600" href={collLinks.codeOfConduct} target="_blank" rel="noreferrer">View Code of Conduct <IconExternal /></a>
          </div>

          <div className="p-4 bg-slate-50 rounded-md">
            <h4 className="font-semibold">Executive Committee</h4>
            <p className="text-sm text-slate-600">Elected leadership and spokespersons for USQCD. Current list (from USQCD reports):</p>
            <ExecCommittee />
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-6 bg-sky-50 rounded-md border border-sky-100 shadow-sm">
            <h4 className="font-semibold text-lg">Meetings & events</h4>
            <p className="text-sm text-slate-600">Annual collaboration meetings, working-group calls, and archives of past meeting materials. Click to view the full meetings index.</p>
            <div className="mt-3">
              <button onClick={() => setActive('meetings')} className="inline-block px-4 py-2 rounded-md bg-gradient-to-r from-cyan-400 to-sky-600 text-white">Open meetings index</button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-md">
            <h4 className="font-semibold">Scientific Program Committee (SPC)</h4>
            <p className="text-sm text-slate-600">Responsible for computing allocations and programmatic review. Current SPC membership (from recent reports):</p>
            <ScientificProgramCommittee />
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-white border border-slate-100 rounded-md">
        <h4 className="font-semibold">How to join</h4>
        <p className="text-sm text-slate-600">To join the collaboration or participate in working groups, contact the collaboration chairs.</p>
        <div className="mt-3">
	<a href="mailto:thomas.blum@uconn.edu" className="inline-block px-4 py-2 rounded-md bg-sky-50 text-sky-700 mr-6">Thomas Blum</a>
	<a href="mailto:wdetmold@mit.edu" className="inline-block px-4 py-2 rounded-md bg-sky-50 text-sky-700">William Detmold</a>
        </div>
      </div>

      <div className="mt-6 p-4 bg-slate-50 rounded-md">
        <h4 className="font-semibold">Membership</h4>
        <p className="text-sm text-slate-600">The full list of USQCD collaboration members across participating institutions.</p>
        <MembersList />
      </div>
    </SectionShell>
  );
}

function ContactSection() {
  return (
    <SectionShell title="Get involved">
      <p>Membership is open to all US-based lattice field theory researchers. Members are able to attend the All-Hands meeting, contribute code, and apply for computing time. Contact the chairs of the executive committee to join.</p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="font-semibold">Chair — Thomas Blum</div>
          <div className="text-sm text-slate-600">Primary contact for collaboration matters.</div>
          <div className="mt-2">
            <a href="mailto:thomas.blum@uconn.edu" className="inline-block px-4 py-2 rounded-md bg-sky-50 text-sky-700">thomas.blum@uconn.edu</a>
          </div>
        </div>
        <div>
          <div className="font-semibold">Deputy Chair — William Detmold</div>
          <div className="text-sm text-slate-600">Secondary contact for collaboration matters.</div>
          <div className="mt-2">
            <a href="mailto:wdetmold@mit.edu" className="inline-block px-4 py-2 rounded-md bg-sky-50 text-sky-700">wdetmold@mit.edu</a>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

export default function USQCDApp() {
  const [active, setActive] = useState('home');
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [active]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header active={active} setActive={setActive} />
      <main className="pt-6">
        {active === 'home' && (
          <>
            <section className="bg-white mb-0">
              <div className="max-w-6xl mx-auto px-6 py-0 grid grid-cols-1 lg:grid-cols-1  items-center">
                <div>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">USQCD — Lattice QCD for particle & nuclear physics</h1>
                  <p className="mt-4 text-slate-600 ">Coordinating computing, software, and expertise across U.S. researchers in lattice field theory to deliver first-principles calculations in lattice QCD for hadron spectroscopy, flavor physics, muon g-2 inputs, extreme matter, and nucleon structure.</p>
		  </div>
		                    <div className="mt-6 flex gap-3">
                    <button onClick={() => setActive('science')} className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-cyan-400 to-sky-600 text-white px-4 py-2 shadow-md">Explore science</button>
                    <button onClick={() => setActive('publications')} className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-cyan-400 to-sky-600 text-white px-4 py-2 shadow-md">See publications</button>
                    <button onClick={() => setActive('software')} className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-cyan-400 to-sky-600 text-white px-4 py-2 shadow-md">Use codes</button>
                  </div>
		  </div>
		  </section>
	<section className="bg-white">
              <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div>
		  <div className="mt-4 text-slate-600 max-w-xl">
		  <p><b>Quantum chromodynamics (QCD)</b> is the component of the Standard Model of elementary particle physics that governs the strong interactions. It describes how <b>quarks</b> and <b>gluons</b>, the fundamental entities of strongly interacting matter, are bound together to form strongly interacting particles, such as protons and neutrons, and it determines how these particles in turn interact to form atomic nuclei and dense astrophysical environments.</p>

<p>The Standard Model has been enormously successful; however, our knowledge of it is incomplete because it has proven extremely difficult to extract many of the most important predictions of QCD, those that depend on the strong coupling regime of the theory. To do so from first principles and with controlled systematic errors requires large scale numerical simulations within the framework of <b>lattice field theory</b>. Such simulations are needed to address problems that are at the heart of the Department of Energy's large experimental programs in high energy and nuclear physics.
Our immediate objectives are to:</p>
<ol className="list-decimal list-inside space-y-2">
  <li>calculate the effects of the strong interactions on weak interaction processes to the accuracy needed to make precise tests of the Standard Model and to serch for evidence of physics beyond the Standard Model;</li>
  <li>determine the properties of strongly interacting matter under extreme conditions such as those that existed in the very early development of the universe, and are created today in relativistic heavy ion collisions;</li>
  <li>calculate the masses of strongly interacting particles and obtain a quantitative understanding of their internal structure</li>
  <li> lay the foundations for investigations of strongly interacting sectors of new physics which may be discovered at the LHC.
  </li>
  </ol>
  		  </div>
                </div>
   	        <div className="max-w-6xl mx-auto px-6 py-12">
        	     <FiguresCarousel jsonPath={resolvePath('static/data/figures.json')} interval={7000} maxCaptionWords={30} maxImageHeight={300} />
      	        </div>
              </div>
            </section>

            <ScienceSection />
            <PublicationsSection />
            <ResourcesSection />
            <ContactSection />
          </>
        )}
        {active === 'science' && <ScienceSection />}
        {active === 'publications' && <PublicationsSection />}
        {active === 'resources' && <ResourcesSection />}
        {active === 'collaboration' && <CollaborationPage setActive={setActive} />}
        {active === 'meetings' && <MeetingsPage />}
	{active === 'software' && <Software />}
        {active === 'contact' && <ContactSection />}
      </main>
      <footer className="border-t border-slate-100 mt-12 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-slate-500">
          <div>© USQCD — prototype • content curated from USQCD collaboration pages.</div>
        </div>
      </footer>
    </div>
  );
}
