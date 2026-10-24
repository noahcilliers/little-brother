import type { Metadata } from "next";
import "@/styles/ui.css";
import "@/styles/onboarding.css";
import { Suspense } from "react";
import { Onboarding } from "@/components/onboarding/onboarding";
import { PublicApp } from "@/components/public-app";

export const metadata: Metadata = { title: "Get started · Little Brother" };

export default function OnboardingPage() {
  return (
    <PublicApp>
      <Suspense>
        <Onboarding />
      </Suspense>
    </PublicApp>
  );
}
