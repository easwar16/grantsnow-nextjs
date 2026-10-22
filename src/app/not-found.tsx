import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="state">
      <h1>Page not found</h1>
      <Link id="not-found-home" href="/home">
        Go to Home
      </Link>
    </main>
  );
}
