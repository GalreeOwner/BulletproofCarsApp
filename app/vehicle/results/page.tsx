import { Suspense } from "react";
import VehicleResultsClient from "./VehicleResultsClient";

export const dynamic = "force-dynamic";

export default function VehicleResultsPage() {
  return (
    <Suspense fallback={<div className="p-6 max-w-3xl mx-auto">Loading results…</div>}>
      <VehicleResultsClient />
    </Suspense>
  );
}
