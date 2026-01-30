import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Hostinger deployment
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fiswicudrwykphlojjni.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
