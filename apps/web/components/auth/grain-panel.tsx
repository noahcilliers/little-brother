/** The login page's right half: a monochrome gradient with film grain and a faint board drawn on it. */
export function GrainPanel() {
  return (
    <div className="grain-panel" aria-hidden="true">
      <svg className="grain" width="100%" height="100%" aria-hidden="true">
        <filter id="lb-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#lb-grain)" />
      </svg>
      <div className="ghost-board">
        {[0, 1, 2, 3].map((lane) => (
          <div key={lane} className="ghost-lane">
            <i className="ghost-who" />
            <span className={`ghost-bar g${lane}a`} />
            <span className={`ghost-bar g${lane}b`} />
          </div>
        ))}
        <span className="ghost-link" />
      </div>
      <p className="grain-caption">
        Your agents can't see each other.
        <br />
        little brother can.
      </p>
    </div>
  );
}
