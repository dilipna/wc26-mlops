import Link from "next/link";
export default function Footer() {
  return (
    <footer className="platform-footer">
      <div className="platform-footer-top">
        <div>
          <Link className="platform-brand" href="/">
            SpOps<span className="platform-brand-period">.</span>
          </Link>
          <p>Follow the game. Inspect the evidence.</p>
          <small>A sports intelligence project by Dilip Nallamasa.</small>
        </div>
        <nav aria-label="Explore sports">
          <strong>Explore</strong>
          <Link href="/">Matchday</Link>
          <Link href="/?view=saved#watchlist">Your watchlist</Link>
          <Link href="/#spotlights">Official highlights</Link>
        </nav>
        <nav aria-label="Historical model labs">
          <strong>Model labs</strong>
          <Link href="/basketball">Basketball</Link>
          <Link href="/nfl">American football</Link>
          <Link href="/cricket">Cricket</Link>
          <Link href="/football">Football archive</Link>
        </nav>
        <nav aria-label="Project evidence">
          <strong>Behind SpOps</strong>
          <Link href="/engineering">Model decisions & evidence</Link>
          <Link href="/admin">Platform records</Link>
          <a
            href="https://github.com/dilipna/wc26-mlops/tree/improve/multisport-release"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source & reproduction ↗
          </a>
        </nav>
      </div>
      <div className="platform-footer-bottom">
        <span>
          Free feeds have limited, delayed coverage. Historical model outputs
          are dated research estimates.
        </span>
        <span>
          No trading, betting or financial accounts. Independent of leagues and
          athletes.
        </span>
      </div>
    </footer>
  );
}
