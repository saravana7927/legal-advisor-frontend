"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDocStatus, type UploadStatus } from "@/lib/api";

const STEPS = [
  "Extracting text from document",
  "Identifying clauses and parties",
  "Analysing against Indian law",
] as const;

function StepIndicator({
  done,
  active,
}: {
  done: boolean;
  active: boolean;
}) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
        done
          ? "bg-green-500 text-white"
          : active
            ? "bg-purple-600 text-white animate-pulse"
            : "bg-gray-200 text-gray-500"
      }`}
      aria-hidden
    >
      {done ? "✓" : ""}
    </span>
  );
}

export interface ProcessingStatusProps {
  docId: string;
  onTryAgain: () => void;
}

export function ProcessingStatus({ docId, onTryAgain }: ProcessingStatusProps) {
  const router = useRouter();
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const tick = () =>
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const step0Done = elapsedSec >= 10 || status === "ready";
  const step1Done = elapsedSec >= 25 || status === "ready";
  const step2Done = status === "ready";

  const activeIndex =
    !step0Done ? 0 : !step1Done ? 1 : !step2Done ? 2 : -1;

  const poll = useCallback(async () => {
    try {
      const res = await getDocStatus(docId);
      setStatus(res.status);
      setPollError(null);
      if (res.status === "ready") {
        router.push(`/doc/${encodeURIComponent(docId)}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not reach server";
      setPollError(msg);
    }
  }, [docId, router]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void poll();
    }, 3000);
    const first = window.setTimeout(() => {
      void poll();
    }, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [poll]);

  if (status === "error") {
    return (
      <div className="mt-10 max-w-md mx-auto rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
        <p className="text-red-800 font-medium">Something went wrong</p>
        <p className="text-sm text-red-700 mt-2">
          We could not process this document. Please try again.
        </p>
        <button
          type="button"
          onClick={onTryAgain}
          className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const doneFlags = [step0Done, step1Done, step2Done];

  return (
    <div className="mt-10 w-full max-w-md mx-auto rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900 text-center mb-6">
        Processing your document
      </h2>
      {pollError && (
        <p className="text-sm text-amber-700 text-center mb-4" role="status">
          {pollError} — retrying…
        </p>
      )}
      <ol className="space-y-4">
        {STEPS.map((label, i) => {
          const done = doneFlags[i] ?? false;
          const active = i === activeIndex && !done;
          return (
            <li key={label} className="flex items-start gap-3">
              <StepIndicator done={done} active={active} />
              <div className="pt-1">
                <p
                  className={`text-sm font-medium ${
                    done || active ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {label}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
