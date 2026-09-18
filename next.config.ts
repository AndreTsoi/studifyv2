import type { NextConfig } from "next";
const config: NextConfig = {
  experimental: { workerThreads: true, cpus: 2, useTypeScriptCli: false },
};
export default config;
