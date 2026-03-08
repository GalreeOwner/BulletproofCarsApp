"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [counts, setCounts] = useState({ issues: 0, jobs: 0 });

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const { data: adminRow } = await supabase
        .from("app_admins")
        .select("user_id")
        .eq("user_id", sessionData.session.user.id)
        .maybeSingle();

      if (!adminRow) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      const [{ count: issueCount }, { count: jobCount }] = await Promise.all([
        supabase
          .from("issue_candidates")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("job_candidates")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

      setCounts({
        issues: issueCount ?? 0,
        jobs: jobCount ?? 0,
      });

      setLoading(false);
    })();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return <main className="p-6">Loading…</main>;
  }

  if (!isAdmin) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-2 text-red-600">
          You’re signed in, but not an admin yet.
        </p>
        <p className="mt-2 text-gray-600">
          Add your user id to <code>public.app_admins</code> in Supabase, then
          refresh.
        </p>
        <button className="mt-6 underline" onClick={signOut}>
          Sign out
        </button>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin dashboard</h1>
        <button className="underline text-sm" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold">Pending issue candidates</h2>
          <p className="mt-2 text-3xl font-bold">{counts.issues}</p>
          <Link
            className="underline mt-4 inline-block"
            href="/admin/candidates?tab=issues"
          >
            Review →
          </Link>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-semibold">Pending job candidates</h2>
          <p className="mt-2 text-3xl font-bold">{counts.jobs}</p>
          <Link
            className="underline mt-4 inline-block"
            href="/admin/candidates?tab=jobs"
          >
            Review →
          </Link>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link className="underline" href="/admin/candidates">
          Candidates
        </Link>
        <Link className="underline" href="/admin/seed">
          Seed data
        </Link>
        <Link className="underline" href="/admin/ingest">
          Ingestion
        </Link>
      </div>
    </main>
  );
}