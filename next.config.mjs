const nextConfig = {
  // Limita os workers do build em máquinas com pouca memória, como o Mac de 8 GB.
  experimental: {
    cpus: 1,
    memoryBasedWorkersCount: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
    ],
  },
};

export default nextConfig;
