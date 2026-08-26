import { resolveBrowserDistOutDir } from '../../../sdkwork-specs/tools/browser-dist-layout.mjs';
function resolveViteEnvironment(mode: string | undefined, processEnv = process.env) {
  const profileMatch = /^(standalone|cloud)\.(development|test|staging|production)$/u.exec(mode ?? '');
  return profileMatch?.[2]
    ?? (['development', 'test', 'staging', 'production'].includes(processEnv.SDKWORK_ENVIRONMENT ?? '')
      ? (processEnv.SDKWORK_ENVIRONMENT ?? 'production')
      : 'production');
}


import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, "../..");
const membershipAppSdkEntry = path.resolve(
  workspaceRoot,
  "sdks/sdkwork-membership-app-sdk/sdkwork-membership-app-sdk-typescript/src/index.ts",
);
const DEFAULT_GATEWAY_TARGET = "http://127.0.0.1:18096";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, appRoot, "");
  const proxyTarget = env.VITE_SDKWORK_MEMBERSHIP_PC_APP_API_BASE_URL?.trim()
    || DEFAULT_GATEWAY_TARGET;

  return {
    plugins: [react()],
    root: appRoot,
    resolve: {
      alias: {
      },
    },
    build: {
      outDir: resolveBrowserDistOutDir(resolveViteEnvironment(mode, env)),
      sourcemap: mode !== "production",
    },
    server: {
      host: "127.0.0.1",
      port: 5186,
      proxy: {
        "/app/v3/api/memberships": {
          changeOrigin: true,
          target: proxyTarget,
        },
      },
    },
  };
});
