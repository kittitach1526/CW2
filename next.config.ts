import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow any domain to access the dev server (use only in development)
  allowedDevOrigins: [
    'localhost',
    '**.*',
  ],
};

export default nextConfig;
