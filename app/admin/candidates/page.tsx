import { Suspense } from "react";
import CandidatesClient from "./CandidatesClient";

export const dynamic = "force-dynamic";

export default function AdminCandidatesPage() {
  return (
    <Suspense fallback={<main className="p-6 max-w-4xl mx-auto">Loading candidates…</main>}>
      <CandidatesClient />
    </Suspense>
  );
}
