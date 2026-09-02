import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default bottom-left position overlaps the sidebar's user identity block.
  devIndicators: {
    position: "bottom-right",
  },
  // Default Server Action body limit is 1MB — nowhere near enough for
  // uploadVideoToYouTubeAction's video-file input (Work Order 7).
  // Verified against Next.js's own current docs before setting this (not
  // guessed). NOT verified: whether Netlify's deployed function runtime
  // enforces its own lower request-body ceiling regardless of this
  // app-level config — test with a real, small video file first once
  // YouTube is connected, before assuming large uploads will go through.
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
