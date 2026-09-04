import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default bottom-left position overlaps the sidebar's user identity block.
  devIndicators: {
    position: "bottom-right",
  },
  // Was 100mb for uploadVideoToYouTubeAction's video-file input (Work
  // Order 7) — that path routed the whole video through a Server Action
  // and got rebuilt as a resumable upload straight to YouTube instead
  // (Cleanup work order follow-up) specifically because Netlify's real
  // function body ceiling is ~6MB regardless of this app-level config, so
  // 100mb here was never actually reachable in production. Nothing left
  // in this app sends more than a syllabus PDF (components/uni/syllabus-
  // upload.tsx) through a Server Action — 10mb is generous headroom for
  // that with no reason to leave a much larger ceiling open.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
