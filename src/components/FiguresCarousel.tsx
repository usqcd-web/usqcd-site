// src/components/FiguresCarousel.tsx
import React, { useEffect, useRef, useState } from "react";

type FigureItem = {
  arxiv_id?: string;
  arxiv_link?: string | null;
  title?: string;
  image_file: string; // e.g. "figures/1904.09512/foo.png"
  caption_full?: string;
  caption_excerpt?: string;
};

export default function FiguresCarousel({
  jsonPath = "/static/data/figures.json",
  interval = 6000,
  maxCaptionWords = 100,
  maxImageHeight = 500, // px
  doeScienceHighlight = false,
}: {
  jsonPath?: string;
  interval?: number;
  maxCaptionWords?: number;
  maxImageHeight?: number;
  doeScienceHighlight?: bool;
}) {
  const [items, setItems] = useState<FigureItem[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Track fallback attempts per slide
  const triesRef = useRef<Record<number, number>>({});

  useEffect(() => {
    let mounted = true;
    fetch(jsonPath)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${jsonPath}`);
        return r.json();
      })
      .then((j) => {
        if (!mounted) return;
        const arr = Array.isArray(j) ? j : Object.values(j).flat();
        setItems(arr as FigureItem[]);
      })
      .catch(() => {
        if (mounted) setError("Unable to load figures.");
      });
    return () => {
      mounted = false;
    };
  }, [jsonPath]);

  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % items.length), interval);
    return () => clearInterval(t);
  }, [items, interval]);

  function truncateWords(text = "", n = maxCaptionWords) {
    const w = text.trim().split(/\s+/).filter(Boolean);
    return w.length <= n ? text : w.slice(0, n).join(" ") + "…";
  }

  function getImageCandidates(image_file: string): string[] {
    if (!image_file) return [];
    const clean = image_file.replace(/\\/g, "/").replace(/^\/+/, "");
    return [`/static/data/${clean}`, `/static/${clean}`, clean];
  }

  function handleImgError(ev: React.SyntheticEvent<HTMLImageElement, Event>, idx: number) {
    const img = ev.currentTarget;
    const item = items[idx];
    if (!item) return;
    const candidates = getImageCandidates(item.image_file);
    const prev = triesRef.current[idx] || 0;
    const next = prev + 1;
    if (next < candidates.length) {
      triesRef.current[idx] = next;
      img.src = candidates[next];
    } else {
      img.src = "/static/data/placeholder-figure-missing.png";
    }
  }

  if (error) {
    return <div className="p-4 rounded-lg bg-slate-50 text-sm text-red-600">{error}</div>;
  }

  if (!items.length) {
    return <div className="p-6 bg-slate-50 rounded-lg text-sm text-slate-500">No figures available.</div>;
  }

  const active = items[activeIdx];
  triesRef.current[activeIdx] = triesRef.current[activeIdx] || 0;
  const candidates = getImageCandidates(active.image_file);
  const imgSrc = candidates[0];

  return (

      <div className="rounded-2xl border border-slate-200 shadow-lg bg-white overflow-hidden">
        <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4">
          {/* Image + caption column */}
          <div className="w-full md:w flex flex-col items-center">
            <div
              className="rounded-lg overflow-hidden border border-slate-100 bg-slate-50 w-full flex items-center justify-center"
              style={{ maxWidth: 540 }}
            >
              {/* Image: constrained by maxImageHeight, preserving aspect ratio */}
              <img
                src={imgSrc}
                alt={active.title || active.arxiv_id || "figure"}
                className="w-full object-contain"
                style={{ maxHeight: `${maxImageHeight}px` }}
                loading="lazy"
                onError={(e) => handleImgError(e, activeIdx)}
              />
            </div>

            {/* Caption underneath the figure */}
            <div className="mt-3 w-full text-sm text-slate-700 prose prose-slate max-w-full">
              {active.caption_excerpt || active.caption_full ? (
                <div>{truncateWords(active.caption_excerpt || active.caption_full || "", maxCaptionWords)}</div>
              ) : (
                <div className="text-slate-500"></div>
              )}
            </div>
            <div className="text-sm text-slate-500 mb-2">
              {active.title || (active.arxiv_id ? `arXiv:${active.arxiv_id}` : "")}
            </div>

            <div className="text-xs text-slate-500 mb-4">
              {active.arxiv_link ? (
                <a href={active.arxiv_link} target="_blank" rel="noreferrer" className="text-sky-600 font-medium">
                  View on arXiv ↗
                </a>
              ) : null}
              {active.link ? (
                <a href={active.link} target="_blank" rel="noreferrer" className="text-sky-600 font-medium">
                  View DOE Science Highlight ↗
                </a>
              ) : null}
            </div>

            <div className="mt-auto">

{/* Dots: show a circular window of up to 11 buttons centered on active */}
{(() => {
  const radius = 5; // show up to `radius` before and after => window size = 2*radius + 1
  const n = items.length;
  // if list is short, show all
  if (n <= 2 * radius + 1) {
    return (
      <div className="mt-4 flex gap-2">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`w-2 h-2 rounded-full ${i === activeIdx ? "bg-sky-600" : "bg-slate-300"}`}
          />
        ))}
      </div>
    );
  }

  // otherwise compute visible circular indices centered on activeIdx
  const visible: number[] = [];
  for (let offset = -radius; offset <= radius; offset++) {
    const idx = (activeIdx + offset + n) % n;
    visible.push(idx);
  }

  return (
    <div className="mt-4 flex gap-2 items-center">
      {visible.map((i) => (
        <button
          key={i}
          onClick={() => setActiveIdx(i)}
          aria-label={`Go to slide ${i + 1}`}
          className={`w-2 h-2 rounded-full ${i === activeIdx ? "bg-sky-600" : "bg-slate-300"}`}
        />
      ))}
    </div>
  );
})()}

            </div>
          </div>
        </div>
      </div>

  );
}
