"use client";

import { useCallback, useRef, useState } from "react";
import { uploadPdf } from "@/lib/api";

const PDF_MIME = "application/pdf";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface UploadZoneProps {
  onUploaded: (docId: string, fileName: string) => void;
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const validateAndSetFile = useCallback((f: File | null) => {
    setError(null);
    if (!f) return;
    const isPdf =
      f.type === PDF_MIME || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Please upload a PDF file only.");
      setFile(null);
      return;
    }
    setFile(f);
  }, []);

  const doUpload = useCallback(
    async (f: File) => {
      setUploading(true);
      setError(null);
      try {
        const res = await uploadPdf(f);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            `lexai_doc_${res.doc_id}_name`,
            f.name
          );
        }
        onUploaded(res.doc_id, f.name);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setError(msg);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (uploading) return;
      const dropped = e.dataTransfer.files?.[0];
      validateAndSetFile(dropped ?? null);
      if (dropped && (dropped.type === PDF_MIME || dropped.name.toLowerCase().endsWith(".pdf"))) {
        void doUpload(dropped);
      }
    },
    [uploading, validateAndSetFile, doUpload]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!uploading) setDragActive(true);
    },
    [uploading]
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragActive(false);
    }
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      validateAndSetFile(f);
      if (f && (f.type === PDF_MIME || f.name.toLowerCase().endsWith(".pdf"))) {
        void doUpload(f);
      }
    },
    [validateAndSetFile, doUpload]
  );

  const zoneClass = uploading
    ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-80"
    : dragActive
      ? "border-solid border-purple-600 bg-purple-50/80"
      : "border-dashed border-gray-300 bg-white hover:border-purple-400 hover:bg-gray-50/80";

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!uploading) inputRef.current?.click();
          }
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        className={`rounded-xl border-2 p-10 text-center transition-colors shadow-sm ${zoneClass}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={onFileChange}
        />
        <p className="text-gray-700 font-medium">
          {uploading ? "Uploading…" : "Drop your PDF here or click to browse"}
        </p>
        <p className="text-sm text-gray-500 mt-2">PDF only</p>
        {file && !uploading && (
          <p className="text-sm text-purple-700 mt-4 font-medium truncate px-2">
            {file.name} · {formatBytes(file.size)}
          </p>
        )}
      </div>
      {error && (
        <p className="mt-3 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
