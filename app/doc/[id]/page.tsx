"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getDocAnalysis,
  getDocStatus,
  type ClauseAnalysis,
  type DocStatusResponse,
} from "@/lib/api";
import { ClauseCard, sortClausesByRisk } from "@/components/ClauseCard";
import { ChatPanel } from "@/components/ChatPanel";

type RiskFilter = "high" | "medium" | "low" | null;

function normalizeRisk(r: string): "high" | "medium" | "low" | "neutral" {
  const v = r.toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "neutral";
}

function countRisks(clauses: ClauseAnalysis[]) {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const c of clauses) {
    const o = normalizeRisk(String(c.overall_risk));
    if (o === "high") high += 1;
    else if (o === "medium") medium += 1;
    else if (o === "low") low += 1;
  }
  return { high, medium, low };
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 h-40"
        />
      ))}
    </div>
  );
}

export default function DocAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [status, setStatus] = useState<DocStatusResponse | null>(null);
  const [clauses, setClauses] = useState<ClauseAnalysis[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"breakdown" | "chat">("breakdown");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>(null);
  const [fileLabel, setFileLabel] = useState("Document");

  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    const n = sessionStorage.getItem(`lexai_doc_${id}_name`);
    if (n) setFileLabel(n);
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [st, an] = await Promise.all([
        getDocStatus(id),
        getDocAnalysis(id),
      ]);
      setStatus(st);
      setClauses(an);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load document";
      setError(msg);
      setClauses(null);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    if (!clauses) return [];
    return sortClausesByRisk(clauses);
  }, [clauses]);

  const filtered = useMemo(() => {
    if (!riskFilter) return sorted;
    return sorted.filter(
      (c) => normalizeRisk(String(c.overall_risk)) === riskFilter
    );
  }, [sorted, riskFilter]);

  const counts = useMemo(() => countRisks(clauses ?? []), [clauses]);

  const toggleFilter = (r: Exclude<RiskFilter, null>) => {
    setRiskFilter((prev) => (prev === r ? null : r));
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-12">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/"
            className="text-sm font-medium text-purple-600 hover:text-purple-800 mb-3 inline-block"
          >
            ← Upload another document
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {loading ? "Loading…" : fileLabel}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {status?.doc_type && (
                  <span className="rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-xs font-semibold">
                    {status.doc_type}
                  </span>
                )}
                {(status?.parties ?? []).map((p, pi) => (
                  <span
                    key={`party-${pi}-${p}`}
                    className="rounded-full bg-gray-100 text-gray-800 px-2.5 py-0.5 text-xs font-medium"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {!loading && clauses && clauses.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={() => toggleFilter("high")}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  riskFilter === "high"
                    ? "bg-red-100 text-red-800 ring-2 ring-red-300"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {counts.high} High Risk
              </button>
              <button
                type="button"
                onClick={() => toggleFilter("medium")}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  riskFilter === "medium"
                    ? "bg-amber-100 text-amber-900 ring-2 ring-amber-300"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {counts.medium} Medium
              </button>
              <button
                type="button"
                onClick={() => toggleFilter("low")}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  riskFilter === "low"
                    ? "bg-green-100 text-green-900 ring-2 ring-green-300"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {counts.low} Low
              </button>
            </div>
          )}

          <div className="mt-4 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setTab("breakdown")}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                tab === "breakdown"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Breakdown
            </button>
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                tab === "chat"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Chat
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {error && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-center mb-6"
            role="alert"
          >
            <p className="text-red-800 font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !error && <AnalysisSkeleton />}

        {!loading && !error && tab === "breakdown" && (
          <>
            {clauses && clauses.length === 0 && (
              <div className="rounded-xl bg-white border border-gray-100 p-10 text-center shadow-sm">
                <p className="text-gray-600">
                  No clauses were found for this document. Try uploading a
                  different file or check the backend analysis output.
                </p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-4 text-purple-600 font-semibold text-sm hover:underline"
                >
                  Refresh
                </button>
              </div>
            )}
            {clauses && clauses.length > 0 && (
              <div className="space-y-4">
                {filtered.length === 0 ? (
                  <p className="text-center text-gray-600 py-8">
                    No clauses match this risk filter. Click the summary again
                    to show all.
                  </p>
                ) : (
                  filtered.map((c, index) => (
                    <ClauseCard
                      key={`${c.clause_num}-${index}`}
                      clause={c}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}

        {!loading && !error && tab === "chat" && (
          <ChatPanel docId={id} />
        )}
      </div>
    </div>
  );
}
