import { defineConfig } from "vitest/config";
import {
  vitestSetupFilePath,
  getClarinetVitestsArgv,
} from "@stacks/clarinet-sdk/vitest";

export default defineConfig({
  test: {
    environment: "clarinet",
    // We changed 'forks' to 'threads' to stop the crash
    pool: "threads",
    isolate: false,
    maxWorkers: 1,
    setupFiles: [
      vitestSetupFilePath,
    ],
    environmentOptions: {
      clarinet: {
        ...getClarinetVitestsArgv(),
      },
    },
  },
});