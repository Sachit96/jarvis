import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default bottom-left position overlaps the sidebar's user identity block.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
