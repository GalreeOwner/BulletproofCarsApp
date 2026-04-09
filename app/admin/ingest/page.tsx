"use client";

import { useState } from "react";

export default function AdminIngestPage() {
  const [make, setMake] = useState("Honda");
  const [model, setModel] = useState("CR-V");
  const [year, setYear] = useState("2011");

  const [dealerUrl, setDealerUrl] = useState("");
  const [dealerName, setDealerName] = useState("Dealer FAQ");

  const [extractLimit, setExtractLimit] = useState("10");

  const [subreddit, setSubreddit] = useState("MechanicAdvice");
  const [redditLimit, setRedditLimit] = useState("10");

  const [result, setResult] = useState<string>("");

  async function ingestNhtsa() {
    setResult("Running NHTSA ingestion...");
    const res = await fetch("/api/ingest/nhtsa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ make, model, year }),
    });

    const json = await res.json();
    setResult(JSON.stringify(json, null, 2));
  }

  async function ingestDealer() {
    setResult("Running dealer ingestion...");
    const res = await fetch("/api/ingest/dealer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: dealerUrl,
        name: dealerName,
      }),
    });

    const json = await res.json();
    setResult(JSON.stringify(json, null, 2));
  }

  async function runExtraction() {
    setResult("Running extraction...");
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: Number(extractLimit),
      }),
    });

    const json = await res.json();
    setResult(JSON.stringify(json, null, 2));
  }

  async function ingestReddit() {
    setResult("Running Reddit ingestion...");
    const res = await fetch("/api/ingest/reddit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subreddit,
        limit: Number(redditLimit),
      }),
    });

    const json = await res.json();
    setResult(JSON.stringify(json, null, 2));
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Admin • Ingestion</h1>
      <p className="mt-2 text-gray-600">
        Use this page to ingest raw source documents, then run extraction to create reviewable candidates.
      </p>

      <div className="mt-6 border rounded-xl p-4">
        <h2 className="font-semibold">NHTSA Recall Ingestion</h2>
        <div className="grid gap-3 sm:grid-cols-3 mt-3">
          <input
            className="border rounded-lg p-2"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Make"
          />
          <input
            className="border rounded-lg p-2"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model"
          />
          <input
            className="border rounded-lg p-2"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Year"
          />
        </div>
        <button
          className="mt-4 rounded-lg bg-black text-white px-4 py-2"
          onClick={ingestNhtsa}
        >
          Ingest NHTSA recalls
        </button>
      </div>

      <div className="mt-6 border rounded-xl p-4">
        <h2 className="font-semibold">Dealer / FAQ Page Ingestion</h2>
        <input
          className="border rounded-lg p-2 w-full mt-3"
          placeholder="https://dealer-site.example/faq-page"
          value={dealerUrl}
          onChange={(e) => setDealerUrl(e.target.value)}
        />
        <input
          className="border rounded-lg p-2 w-full mt-3"
          placeholder="Dealer source name"
          value={dealerName}
          onChange={(e) => setDealerName(e.target.value)}
        />
        <button
          className="mt-4 rounded-lg bg-black text-white px-4 py-2"
          onClick={ingestDealer}
        >
          Ingest dealer page
        </button>
      </div>

      <div className="mt-6 border rounded-xl p-4">
        <h2 className="font-semibold">Extraction</h2>
        <p className="mt-2 text-sm text-gray-600">
          Convert new source documents into issue and job candidates for review.
        </p>
        <input
          className="border rounded-lg p-2 w-full mt-3"
          value={extractLimit}
          onChange={(e) => setExtractLimit(e.target.value)}
          placeholder="How many new source documents to process"
        />
        <button
          className="mt-4 rounded-lg bg-black text-white px-4 py-2"
          onClick={runExtraction}
        >
          Run extraction
        </button>
      </div>

      <div className="mt-6 border rounded-xl p-4">
        <h2 className="font-semibold">Reddit Ingestion</h2>
        <input
          className="border rounded-lg p-2 w-full mt-3"
          placeholder="Subreddit name"
          value={subreddit}
          onChange={(e) => setSubreddit(e.target.value)}
        />
        <input
          className="border rounded-lg p-2 w-full mt-3"
          placeholder="Limit"
          value={redditLimit}
          onChange={(e) => setRedditLimit(e.target.value)}
        />
        <button
          className="mt-4 rounded-lg bg-black text-white px-4 py-2"
          onClick={ingestReddit}
        >
          Ingest Reddit posts
        </button>
      </div>

      <pre className="mt-6 border rounded-xl p-4 text-sm overflow-auto whitespace-pre-wrap">
        {result}
      </pre>
    </main>
  );
}