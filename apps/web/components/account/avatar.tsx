/** GitHub avatar, or the handle's first letter when there is none. */
export function Avatar({ src, name, size = 26 }: { src?: string; name: string; size?: number }) {
  const style = { width: size, height: size };
  return src ? (
    // biome-ignore lint/performance/noImgElement: tiny remote avatar; next/image would need a remote host allowlist
    <img className="avatar" src={src} alt="" style={style} />
  ) : (
    <span className="avatar" style={style} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
