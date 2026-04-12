import { Suspense } from "react";
import IssueDetailClient from "./IssueDetailClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    issueId: string;
  }>;
};

export default async function IssuePage({ params }: PageProps) {
  const { issueId } = await params;

  return (
    <Suspense
      fallback={
        <main className="p-6 max-w-3xl mx-auto">
          <p>Loading issue…</p>
        </main>
      }
    >
      <IssueDetailClient issueId={issueId} />
    </Suspense>
  );
}