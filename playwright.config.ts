import { defineConfig, devices } from "@playwright/test";

// The service worker only registers in production builds, so e2e runs against `next start`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 240_000,
  },
  projects: [
    { name: "phone-small", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 640 } } },
    { name: "phone-large", use: { ...devices["Pixel 7"], viewport: { width: 430, height: 932 } } },
  ],
});
