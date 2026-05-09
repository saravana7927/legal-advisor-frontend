"use client";

import { useMemo, useState } from "react";
import type { ClauseAnalysis } from "@/lib/api";
import { RiskBadge } from "@/components/RiskBadge";

function riskRank(r: string): number {
  const v = r.toLowerCase();
  if (v === "high") return 0;
  if (v === "medium") return 1;
  if (v === "low") return 2;
  return 3;
}

export interface ClauseCardProps {
  clause: ClauseAnalysis;
}

export function ClauseCard({ clause }: ClauseCardProps) {
  const [showRaw, setShowRaw] = useState(false);
  const overall = String(clause.overall_risk);

  const partyEntries = useMemo(
    () => Object.entries(clause.risk_per_party ?? {}),
    [clause.risk_per_party]
  );

  return (
    <article className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-900">
          Clause {clause.clause_num}
        </span>
        <RiskBadge risk={overall} />
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          Favors: {clause.favors}
        </span>
      </div>

      <p className="text-base text-gray-800 leading-relaxed font-medium mb-4">
        {clause.plain_english}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {partyEntries.map(([name, level]) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 text-sm text-gray-700"
          >
            <span className="font-medium">{name}</span>
            <RiskBadge risk={String(level)} label={String(level).toUpperCase()} />
          </span>
        ))}
      </div>

      <div className="flex items-start gap-2 mb-4 text-sm text-gray-600">
        <svg
          className="h-4 w-4 shrink-0 mt-0.5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <span className="font-mono text-xs text-gray-600 leading-relaxed">
          {clause.law_cited}
        </span>
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-sm text-blue-900 mb-4">
        <span className="font-semibold text-blue-800">Recommendation: </span>
        {clause.recommendation}
      </div>

      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="text-sm font-medium text-purple-600 hover:text-purple-800"
      >
        {showRaw ? "Hide original clause" : "Show original clause"}
      </button>
      {showRaw && (
        <div className="mt-2 rounded-lg bg-gray-100 p-3 text-sm text-gray-700 font-mono whitespace-pre-wrap border border-gray-200">
          {clause.raw_text}
        </div>
      )}
    </article>
  );
}

export function sortClausesByRisk(clauses: ClauseAnalysis[]): ClauseAnalysis[] {
  return [...clauses].sort(
    (a, b) => riskRank(String(a.overall_risk)) - riskRank(String(b.overall_risk))
  );
}
