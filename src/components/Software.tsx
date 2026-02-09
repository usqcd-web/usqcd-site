// src/components/Software.tsx
import React from "react";

/**
 * Software.tsx
 * A self-contained software listing page for the USQCD site.
 *
 * - Core software (Chroma, MILC, QLUA, Grid, QUDA) shown at top level
 * - Secondary section links to other notable projects and the usqcd-software org page
 *
 * Drop this file into src/pages/ and import / route it from your main app.
 */

function IconExternal() {
  return (
    <svg
      className="w-4 h-4 inline-block ml-1"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m3-3h5v5M10 14L21 3"
      />
    </svg>
  );
}

type Repo = {
  name: string;
  url: string;
  description: string;
  tags?: string[];
};

const coreSoftware: Repo[] = [
  {
    name: "Chroma",
    url: "https://github.com/JeffersonLab/chroma",
    description:
      "A comprehensive lattice QCD software system for gauge generation, propagator inversion, spectroscopy, and matrix-element calculations, built on the QDP++ data-parallel framework.",
    tags: ["C++", "QDP++"],
  },
  {
    name: "MILC",
    url: "https://github.com/milc-qcd/milc_qcd",
    description:
      "A widely used lattice QCD code for gauge-field generation and physics measurements, supporting improved staggered fermions and modern HPC systems.",
    tags: ["C", "Production"],
  },
  {
    name: "QLUA",
    url: "https://github.com/usqcd-software/qlua",
    description:
      "A Lua-based scripting and workflow layer for lattice QCD, enabling rapid prototyping, workflow control, and analysis on top of USQCD libraries.",
    tags: ["Lua", "Scripting"],
  },
  {
    name: "Grid",
    url: "https://github.com/paboyle/Grid",
    description:
      "A high-performance C++ data-parallel framework for lattice field theory, designed for modern CPU and accelerator architectures.",
    tags: ["C++", "Data-parallel"],
  },
  {
    name: "QUDA",
    url: "https://github.com/lattice/quda",
    description:
      "GPU-accelerated solvers and kernels for lattice QCD, delivering high performance on NVIDIA and AMD GPUs.",
    tags: ["CUDA", "GPU"],
  },
];

const notableProjects: Repo[] = [
  {
    name: "SIMULATeQCD",
    url: "https://github.com/LatticeQCD/SIMULATeQCD",
    description:
      "A flexible lattice QCD codebase supporting a variety of gauge and fermion actions, commonly used for finite-temperature and BSM studies.",
    tags: ["C++"],
  },
  {
    name: "susy",
    url: "https://github.com/daschaich/susy",
    description:
      "Lattice simulations of supersymmetric gauge theories and related quantum field theories beyond QCD.",
    tags: ["Research"],
  },
  {
    name: "USQCD software org (browse all repos)",
    url: "https://github.com/orgs/usqcd-software/repositories",
    description:
      "The usqcd-software GitHub organization hosts community-maintained libraries, tools, and infrastructure developed under the USQCD umbrella.",
  },
];

export default function Software(): JSX.Element {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">
          Software
        </h1>
        <p className="mt-3 text-slate-600 max-w-3xl">
          The USQCD collaboration and the broader lattice community maintain a
          robust ecosystem of open-source software for lattice gauge theory.
          Below are the core codes and notable projects commonly used in
          production and research.
        </p>
      </header>

      {/* Core software */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Core USQCD Software</h2>
        <p className="text-slate-600 mb-6">
          These projects form the core software ecosystem used by the USQCD
          collaboration for production and research.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {coreSoftware.map((repo) => (
            <div
              key={repo.name}
              className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold leading-tight">
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline text-slate-900"
                    >
                      {repo.name}
                      <IconExternal />
                    </a>
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">{repo.description}</p>
                </div>

                {repo.tags && repo.tags.length > 0 ? (
                  <div className="hidden md:flex flex-col items-end text-xs text-slate-500">
                    {repo.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-1 mb-1 bg-slate-50 rounded-full border border-slate-100"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notable / secondary */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Other notable projects</h2>
        <p className="text-slate-600 mb-6">
          Additional repositories and research-oriented codebases relevant to
          the lattice community.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {notableProjects.map((repo) => (
            <div
              key={repo.name}
              className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm"
            >
              <h3 className="text-lg font-semibold mb-2">
                <a href={repo.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {repo.name} <IconExternal />
                </a>
              </h3>
              <p className="text-sm text-slate-600">{repo.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Explore the org */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Explore the USQCD software org</h2>
        <p className="text-slate-600 mb-4">
          The <strong>usqcd-software</strong> GitHub organization contains many
          additional libraries, tools, and community-maintained projects. Browse
          the full listing to discover utilities, middleware, and experiment-specific code.
        </p>
        <a
          href="https://github.com/orgs/usqcd-software/repositories"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sky-600 font-medium"
        >
          Browse USQCD software repositories <IconExternal />
        </a>
      </section>

    </div>
  );
}