import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Studify",
    short_name: "Studify",
    description:
      "Reflect on your study sessions, see what is working, and choose a clearer next step.",
    start_url: "/journal",
    display: "standalone",
    background_color: "#f8f8f7",
    theme_color: "#1a1a1a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
