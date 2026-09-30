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
