import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@modulo/nfe-distribuicao-dfe",
    "@modulo/nfe-transmissao",
  ],
};

export default nextConfig;
