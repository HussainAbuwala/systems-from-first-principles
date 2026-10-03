import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve("dist/server/wrangler.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const targetEnvironment = process.argv[2];

// Vinext currently copies Wrangler's retired `legacy_env` field into the
// generated config. Current Wrangler rejects it, so remove only that field.
delete config.legacy_env;

if (targetEnvironment) {
  const sourceConfig = JSON.parse(fs.readFileSync(path.resolve("wrangler.jsonc"), "utf8"));
  const environment = sourceConfig.env?.[targetEnvironment];
  if (!environment) throw new Error(`Unknown Worker environment: ${targetEnvironment}`);

  config.name = environment.name ?? config.name;
  config.vars = { ...config.vars, ...environment.vars };
  config.d1_databases = environment.d1_databases ?? config.d1_databases;
  if (environment.workers_dev !== undefined) config.workers_dev = environment.workers_dev;
}

fs.writeFileSync(configPath, `${JSON.stringify(config)}\n`);
