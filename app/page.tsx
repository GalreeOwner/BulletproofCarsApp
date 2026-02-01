import Link from "next/link";

export default function HomePage() {
  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">Bulletproof Your Car</h1>
      <p className="mt-2 text-gray-600">
        Search your vehicle and see the most common failure points—ranked from easiest to fix to most complex.
      </p>

      <div className="mt-6">
        <Link
          href="/vehicle"
          className="inline-block rounded-lg bg-black text-white px-5 py-3"
        >
          Start with your vehicle
        </Link>
      </div>
    </main>
  );
}
