import { ThemeButton } from "./theme-button";

type Props = { signedIn: boolean; links?: boolean };

/** Sticky top bar of the landing page. */
export function LandingNav({ signedIn, links = true }: Props) {
  return (
    <nav className="nav">
      <div className="wrap">
        <a className="word" href="/">
          little brother<i>▍</i>
        </a>
        {links ? (
          <div className="links">
            <a href="/#demo">demo</a>
            <a href="/#results">results</a>
            <a href="/#features">features</a>
            <a href="/#how">how it works</a>
            <a href="/#why">why</a>
            <a href="/#stack">stack</a>
            <a href="/#connect">connect</a>
            <a href="/report">report</a>
          </div>
        ) : (
          <span className="nav-spacer" />
        )}
        <ThemeButton />
        {signedIn ? (
          <a className="btn inv" href="/app">
            Open dashboard
          </a>
        ) : (
          <>
            <a className="nav-signin" href="/login">
              Sign in
            </a>
            <a className="btn inv" href="/login">
              Get started
            </a>
          </>
        )}
      </div>
    </nav>
  );
}
