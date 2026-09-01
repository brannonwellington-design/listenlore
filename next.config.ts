import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The site is served through Listen Labs' custom domains, which proxy
      // to Vercel; without these, Next's CSRF origin check silently rejects
      // every form submission (gate, moment forms).
      allowedOrigins: [
        "listenlore.preview.listenlabs.com",
        "*.preview.listenlabs.com",
        "*.listenlabs.com",
      ],
      // Moment submissions carry up to 6 photos at 10 MB each.
      bodySizeLimit: "64mb",
    },
  },
};

export default nextConfig;
