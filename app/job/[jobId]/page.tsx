import { Suspense } from "react";
import JobDetailClient from "./JobDetailClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

export default async function JobPage({ params }: PageProps) {
  const { jobId } = await params;

  return (
    <Suspense
      fallback={
        <main className="p-6 max-w-3xl mx-auto">
          <p>Loading job…</p>
        </main>
      }
    >
      <JobDetailClient jobId={jobId} />
    </Suspense>
  );
}