import { APP_NAME } from "@lunchtable/shared-types";
import { BotRunner, loadConfig } from "./runner";

const config = loadConfig();
const runner = new BotRunner(config);

const shutdown = async (signal: string) => {
  console.log(`[${APP_NAME}] stopping bot runner on ${signal}.`);
  await runner.stop();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await runner.start();
