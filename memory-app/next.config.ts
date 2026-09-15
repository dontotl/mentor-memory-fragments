import type { NextConfig } from "next";

// Static guide/viewer isolation only. Keep this in sync with the guide's
// earliest CSP meta, which also protects its file:// and srcdoc contexts.
const guidePolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' data: blob:",
  "frame-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  turbopack: { root: process.cwd() },
  async headers() {
    return ['/project.html', '/architecture.html', '/interview-sequence.html'].map((source) => ({
      source,
      headers: [
        { key: 'Content-Security-Policy', value: guidePolicy },
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
      ],
    }));
  },
};
export default config;
