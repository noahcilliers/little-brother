import type { Metadata } from "next";
import { LaptopsPage } from "@/components/laptops/laptops-page";

export const metadata: Metadata = { title: "Laptops · Little Brother" };

export default function Laptops() {
  return <LaptopsPage />;
}
