import { defineConfig } from "vitest/config";
import {
  vitestSetupFilePath,
  getClarinetVitestsArgv,
} from "@stacks/clarinet-sdk/vitest";

/*
  In this file, Vitest is configured so that it works seamlessly with Clarinet and the Simnet.
  ... (Keep all your comments) ...
*/

export default defineConfig({
  test: {
    environment: "clarinet",
    // CHANGE 1: "forks" -> "threads"
    pool: "threads",
    // clarinet handles test isolation by resetting the simnet between tests
    isolate: false,
    // CHANGE 2: DELETE OR COMMENT OUT THIS LINE
    // maxWorkers: 1, 
    setupFiles: [
      vitestSetupFilePath,
      // custom setup files can be added here
    ],
    environmentOptions: {
      clarinet: {
        ...getClarinetVitestsArgv(),
        // add or override options
      },
    },
  },
});