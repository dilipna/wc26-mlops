export default function Footer() {
  return (
    <footer className="font-mono relative z-10 mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 border-t border-foreground/10 px-6 py-10 text-xs text-foreground/40">
      <div>
        <a href="https://github.com/dilipna/wc26-mlops" className="hover:text-foreground transition-colors">
          WC26-MLOps
        </a>{" "}
        &middot; daily probability tracker, built as an MLOps portfolio project
      </div>
      <div>Market data via The Odds API &middot; predictions are estimates, not betting advice &middot; not affiliated with FIFA</div>
    </footer>
  );
}
