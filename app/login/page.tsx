"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/admin");
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setBusy(true);

  try {
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    // For sign-up, Supabase may create the user without an active session
    // if email confirmation is required.
    if (mode === "signup") {
      setError(
        "Account created. If confirmation is required, confirm your email first, then sign in."
      );
      return;
    }

    router.push("/admin");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unexpected auth error");
  } finally {
    setBusy(false);
  }
}

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold">
        {mode === "signin" ? "Admin sign in" : "Create admin account"}
      </h1>

      <form className="mt-6 space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full border rounded-lg p-3"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-lg p-3"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          className="w-full rounded-lg bg-black text-white p-3 disabled:opacity-50"
          disabled={busy}
        >
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <button
        className="mt-4 text-sm underline"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>

      <p className="mt-6 text-xs text-gray-500">
        You will still need to add your user id to <code>app_admins</code> in Supabase
        to access admin pages.
      </p>
    </main>
  );
}