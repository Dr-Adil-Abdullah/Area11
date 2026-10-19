/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Area11 — Pharmacy POS",
    short_name: "Area11",
    description: "Smart Pharmacy & Retail POS + Inventory (offline-first)",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#0e7490",
    icons: [],
  };
}

*/

export default function manifest() {
  return {
    name: "Windows Software",
    short_name: "Windows Software",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0e7490",
    icons: [],
  };
}
