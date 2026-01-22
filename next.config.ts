import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fiswicudrwykphlojjni.supabase.co",
      },
    ],
  },
};

export default nextConfig;
