import type { Metadata } from "next";
import "@/app/landing.css";
import "@/components/report/report.css";
import { LandingNav } from "@/components/landing/landing-nav";
import { ReportClassifier } from "@/components/report/report-classifier";
import { ReportEval, ReportNext } from "@/components/report/report-eval";
import { ReportIntro, TOC } from "@/components/report/report-intro";

export const metadata: Metadata = {
  title: "Technical report · Little Brother",
  description:
    "A cost-aware coordination layer for parallel coding agents: architecture, classifier and pilot evaluation.",
};

export default function ReportPage() {
  return (
    <div className="lp">
      <LandingNav signedIn={false} links={false} />
      <main className="wrap rp">
        <header className="rp-head">
          <span className="label">Technical report · October 2026</span>
          <h1>Little Brother: a cost-aware coordination layer for parallel coding agents</h1>
          <p>Ash, Noah, Joshua · every number names the file in the repository it comes from.</p>
        </header>
        <nav className="rp-toc" aria-label="Contents">
          {TOC.map(([id, title], i) => (
            <a key={id} href={`#${id}`}>
              {i + 1}. {title}
            </a>
          ))}
        </nav>
        <ReportIntro />
        <ReportClassifier />
        <ReportEval />
        <ReportNext />
        <footer>
          <a href="/">← little brother</a>
          <a href="https://github.com/noahcilliers/little-brother">source on GitHub</a>
        </footer>
      </main>
    </div>
  );
}
