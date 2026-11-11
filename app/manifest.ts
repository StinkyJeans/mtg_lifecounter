import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledger — MTG Life Counter",
    short_name: "Ledger",
    description: "Offline life counter for Magic: The Gathering.",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14110d",
    theme_color: "#14110d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
