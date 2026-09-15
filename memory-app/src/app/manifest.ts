import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "기억의 조각",
    short_name: "기억의 조각",
    description: "사진에서 시작하는 나의 이야기",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F5F0",
    theme_color: "#1B5E20",
    lang: "ko",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
