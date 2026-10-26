"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="card">
      <h1>We couldn’t load this page</h1>
      <p>
        No change has been confirmed. Try loading the latest information again.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
