import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/sage-sr/import": [
      "./node_modules/pdfjs-dist/legacy/**/*",
      "./node_modules/pdfjs-dist/wasm/**/*",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/pdfjs-dist/cmaps/**/*",
    ],
  },
  experimental: {
    // proxy.ts buffers every request body (default 10MB) and silently truncates
    // anything larger. The SAGE-SR import route accepts files up to 20MB, so the
    // proxy limit has to match or a large Core Response PDF would arrive corrupt
    // and pdfjs would throw — which the route previously turned into an HTML 500
    // that the dialog couldn't parse.
    proxyClientMaxBodySize: "20mb",
  },
}

export default nextConfig
