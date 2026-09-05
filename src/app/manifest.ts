import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FSY Sessão Ribeirão Preto 2 2027",
    short_name: "FSY RP 2",
    description: "Aplicativo oficial da Sessão Ribeirão Preto 2 do FSY Brasil 2027",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0B1528",
    theme_color: "#007DA5",
    orientation: "portrait",
    categories: ["events", "education", "lifestyle"],
    lang: "pt-BR",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
