import Link from "next/link";

export default function AdminPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin</h1>
      <p style={{ marginTop: 12 }}>
        Welcome. This is the admin area (Phase 2). Use the links below.
      </p>

      <ul style={{ marginTop: 16, display: "grid", gap: 8 }}>
        <li>
          <Link href="/admin/candidates" style={{ textDecoration: "underline" }}>
            Review candidates
          </Link>
        </li>
        <li>
          <Link href="/admin/seed" style={{ textDecoration: "underline" }}>
            Seed data
          </Link>
        </li>
      </ul>
    </main>
  );
}
