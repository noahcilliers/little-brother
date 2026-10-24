import type { Metadata } from "next";
import { AppIndex } from "@/components/app/app-index";

export const metadata: Metadata = { title: "Little Brother" };

export default function AppPage() {
  return <AppIndex />;
}
