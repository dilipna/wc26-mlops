export default function Nav() {
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 sm:px-8"
      style={{ background: "linear-gradient(180deg, rgba(13,12,10,0.85), rgba(13,12,10,0))" }}
    >
      <div className="font-mono text-[10px] italic tracking-wide text-[#945151]">
        AN MLOPS PROJECT BY DILIP FT. THE FIFA WORLD CUP
      </div>
      <div className="flex items-center gap-4 sm:gap-7">
        <div className="hidden gap-7 text-xs uppercase tracking-[0.12em] text-foreground/55 md:flex">
          <a href="#leaderboard" className="hover:text-foreground transition-colors">Favorites</a>
          <a href="#country" className="hover:text-foreground transition-colors">Country</a>
          <a href="#fixtures" className="hover:text-foreground transition-colors">Fixtures</a>
          <a href="#backtest" className="hover:text-foreground transition-colors">Proof</a>
          <a href="#stack" className="hover:text-foreground transition-colors">Stack</a>
        </div>
        <a
          href="/admin"
          title="Read-only internal admin dashboard"
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-foreground/70 transition-colors hover:border-foreground/50 hover:text-foreground"
        >
          Admin Dashboard
        </a>
      </div>
    </div>
  );
}
