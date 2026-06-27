/**
 * SoterAI Zapier App — main entry point.
 *
 * Registers authentication and all "Create" actions so Zapier
 * can discover and execute them.
 */

import authentication from "./authentication";
import {
  inputGuard,
  outputGuard,
  piiRedactor,
  ragScanner,
} from "./creates/guardActions";

const App = {
  version: require("../package.json").version,
  platformVersion: require("zapier-platform-core").version,
  authentication,

  creates: {
    [inputGuard.key]: inputGuard,
    [outputGuard.key]: outputGuard,
    [piiRedactor.key]: piiRedactor,
    [ragScanner.key]: ragScanner,
  },
};

export = App;
