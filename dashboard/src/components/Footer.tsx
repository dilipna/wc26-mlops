export default function Footer() {
  return (
    <footer className="font-mono relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-10 text-xs text-text-muted">
      <div>
        Built by Dilip &middot;{" "}
        <a href="https://github.com/dilipna/wc26-mlops" className="text-series-1 hover:underline">
          code on GitHub
        </a>
      </div>
      <div>Market data via The Odds API &middot; not betting advice &middot; not affiliated with FIFA</div>
    </footer>
  );
}
