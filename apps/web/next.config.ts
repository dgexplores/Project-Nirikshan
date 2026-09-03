import type { NextConfig } from "next";

// Hosting platforms often expose a sibling service as a bare hostname with no
// scheme, which is not a valid rewrite destination. Add https when it is
// missing so either form of the variable works.
const configured = process.env.BACKEND_ORIGIN || "http://localhost:8000";
const backendOrigin = /^https?:\/\//.test(configured)
  ? configured
  : `https://${configured}`;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
