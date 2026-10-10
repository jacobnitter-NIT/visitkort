import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { randomBytes, pbkdf2Sync } from "node:crypto";
const cli = createInterface({ input: process.stdin, output: process.stdout });
const config = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
const run = (args, input) => {
  const r = spawnSync(
    process.execPath,
    ["node_modules/wrangler/bin/wrangler.js", ...args],
    {
      encoding: "utf8",
      ...(input
        ? { input, stdio: ["pipe", "pipe", "pipe"] }
        : { stdio: "inherit" }),
    },
  );
  if (r.status !== 0)
    throw new Error(
      "Cloudflare-kommandoen mislykkedes. Kontrollér kontoadgang og prøv igen.",
    );
  return r.stdout || "";
};
try {
  console.log("\nVisitkort · Cloudflare-opsætning\n");
  if (!process.argv.includes("--local")) {
    console.log(
      "Log ind på din Cloudflare-konto. Brug den konto, hvor Worker visitkort ligger.",
    );
    run(["login"]);
    console.log("\nOpret D1-databasen, hvis den ikke findes:");
    console.log("  npx wrangler d1 create visitkort-db");
    console.log(
      "Hvis den allerede findes, finder du ID under Storage & databases → D1 → visitkort-db.",
    );
    const id = (await cli.question("Indsæt D1 database-ID: ")).trim();
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Ugyldigt database-ID.");
    config.d1_databases[0].database_id = id;
    await writeFile("wrangler.jsonc", JSON.stringify(config, null, 2) + "\n");
    const create = (
      await cli.question("Opret privat R2-bucket visitkort-files? (j/n): ")
    )
      .trim()
      .toLowerCase();
    if (create === "j") run(["r2", "bucket", "create", "visitkort-files"]);
  }
  cli.close();
  console.log(
    "Vælg en adgangskode til din private app. Den gemmes kun som en saltet hash.",
  );
  // TTY input is masked. Non-TTY piping is intentionally not supported for passwords.
  async function hidden(prompt) {
    if (!process.stdin.isTTY)
      throw new Error(
        "Kør setup i en interaktiv terminal for sikker indtastning.",
      );
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return await new Promise((resolve, reject) => {
      let value = "";
      const onData = (data) => {
        for (const ch of data.toString()) {
          if (ch === "\u0003") {
            cleanup();
            reject(new Error("Afbrudt"));
            return;
          }
          if (ch === "\r" || ch === "\n") {
            cleanup();
            resolve(value);
            return;
          }
          if (ch === "\u007f") {
            value = value.slice(0, -1);
            continue;
          }
          if (ch.charCodeAt(0) >= 32) value += ch;
        }
      };
      const cleanup = () => {
        process.stdin.removeListener("data", onData);
        process.stdin.setRawMode(false);
        process.stdout.write("\n");
        process.stdin.pause();
      };
      process.stdin.on("data", onData);
    });
  }
  const password = await hidden("Adgangskode (skjult): ");
  if (password.length < 12) throw new Error("Brug mindst 12 tegn.");
  if (password !== (await hidden("Gentag adgangskode (skjult): ")))
    throw new Error("Adgangskoderne er forskellige.");
  const salt = randomBytes(16);
  const hash =
    "pbkdf2:" +
    salt.toString("base64") +
    ":" +
    pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("base64");
  const secret = randomBytes(48).toString("base64url");
  if (process.argv.includes("--local")) {
    await writeFile(
      ".dev.vars",
      `ADMIN_PASSWORD_HASH="${hash}"\nSESSION_SECRET="${secret}"\n`,
      { mode: 0o600 },
    );
    run(["d1", "migrations", "apply", "DB", "--local"]);
    console.log(
      "\nLokal opsætning klar. Kør npm run build og npm run dev:worker.",
    );
  } else {
    run(["secret", "put", "ADMIN_PASSWORD_HASH"], hash + "\n");
    run(["secret", "put", "SESSION_SECRET"], secret + "\n");
    run(["d1", "migrations", "apply", "DB", "--remote"]);
    console.log(
      "\nCloudflare er klar. Commit wrangler.jsonc med det rigtige database-ID til GitHub, og kør npm run deploy. Ingen adgangskoder skal ind i GitHub.",
    );
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  cli.close();
}
