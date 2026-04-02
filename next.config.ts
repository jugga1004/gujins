import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

export default nextConfig;
