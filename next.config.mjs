/** @type {import('next').NextConfig} */
const isTauriBuild = process.env.TAURI_BUILD === "1"

const nextConfig = {
  // Static export only for the Tauri desktop bundle; dev/default behavior stays server-backed.
  ...(isTauriBuild ? { output: "export", distDir: "out" } : {}),
  images: { unoptimized: true },
}

export default nextConfig
