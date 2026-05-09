"use client";

import { useCallback, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { ProcessingStatus } from "@/components/ProcessingStatus";

export default function HomePage() {
  const [docId, setDocId] = useState<string | null>(null);

  const handleUploaded = useCallback((id: string) => {
    setDocId(id);
  }, []);

  const handleTryAgain = useCallback(() => {
    setDocId(null);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[#F9FAFB]">
      <div className="w-full max-w-lg text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          LexAI
        </h1>
        <p className="mt-3 text-gray-600 text-base sm:text-lg">
          Understand your legal documents. Know your rights.
        </p>
      </div>

      {!docId ? (
        <UploadZone onUploaded={handleUploaded} />
      ) : (
        <ProcessingStatus docId={docId} onTryAgain={handleTryAgain} />
      )}
    </main>
  );
}
