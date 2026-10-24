import type { ReactNode } from "react";
import { CopyField } from "../shell/copy-field";
import { QrCode } from "./qr-code";

type Props = { title: string; hint: string; link: string | null; children?: ReactNode };

/** One scannable link with its plain URL under it, for people who'd rather type or paste. */
export function ShareQrCard({ title, hint, link, children }: Props) {
  return (
    <section className="share-card">
      <h3>{title}</h3>
      <p className="muted small">{hint}</p>
      {link ? (
        <>
          <QrCode text={link} label={title} />
          <CopyField text={link} label={`Copy ${title.toLowerCase()} link`} />
        </>
      ) : (
        <div className="qr qr-off" aria-hidden="true" />
      )}
      {children}
    </section>
  );
}
