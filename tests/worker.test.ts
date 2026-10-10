import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { blankCard } from "../src/model.ts";
const salt = randomBytes(16);
const password = "test-only-private-password";
const hash =
  "pbkdf2:" +
  salt.toString("base64") +
  ":" +
  pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("base64");
test("private library and constrained share links work through D1 and R2", async (t) => {
  const bundle = await build({
    entryPoints: ["worker/index.ts"],
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
  });
  const mf = new Miniflare({
    workers: [
      {
        name: "app",
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: "2025-09-01",
        d1Databases: { DB: "visitkort-test" },
        r2Buckets: ["FILES"],
        bindings: {
          ADMIN_PASSWORD_HASH: hash,
          SESSION_SECRET: randomBytes(48).toString("hex"),
        },
      },
    ],
  });
  try {
    const db = await mf.getD1Database("DB");
    const migration = await readFile("migrations/0001_initial.sql", "utf8");
    for (const sql of migration.split(";").filter((s) => s.trim()))
      await db.prepare(sql).run();
    const conferencesMigration = await readFile(
      "migrations/0002_conferences.sql",
      "utf8",
    );
    await db.prepare(conferencesMigration).run();
    let cookie = "";
    async function request(
      path: string,
      method = "GET",
      data?: unknown,
      auth = true,
      origin = "http://localhost",
    ) {
      return mf.dispatchFetch("http://localhost/api" + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          ...(auth && cookie ? { Cookie: cookie } : {}),
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
    }
    await t.test(
      "unauthenticated clients cannot access any private records",
      async () => {
        for (const path of [
          "/contacts",
          "/conferences",
          "/profile",
          "/shares",
          "/export",
          "/files/" + "a".repeat(64),
        ])
          assert.equal((await request(path)).status, 401);
      },
    );
    await t.test(
      "login rejects wrong password and cross-origin requests",
      async () => {
        assert.equal(
          (await request("/login", "POST", { password: "wrong" })).status,
          401,
        );
        assert.equal(
          (
            await request(
              "/login",
              "POST",
              { password },
              false,
              "https://evil.test",
            )
          ).status,
          403,
        );
        const r = await request("/login", "POST", { password });
        assert.equal(r.status, 200);
        const set = r.headers.get("Set-Cookie")!;
        assert.ok(
          set.includes("HttpOnly") &&
            set.includes("Secure") &&
            set.includes("SameSite=Strict"),
        );
        cookie = set.split(";")[0];
        assert.equal(
          (await (await request("/session")).json()).authenticated,
          true,
        );
      },
    );
    await t.test(
      "R2 images require login or an explicitly selected public photo",
      async () => {
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxQAAAAASUVORK5CYII=",
          "base64",
        );
        const boundary = "visitkort-test-boundary";
        const multipart = Buffer.concat([
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`,
          ),
          png,
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);
        const response = await mf.dispatchFetch("http://localhost/api/upload", {
          method: "POST",
          headers: {
            Origin: "http://localhost",
            Cookie: cookie,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: multipart,
        });
        assert.equal(response.status, 201);
        const fileId = (await response.json()).id;
        assert.equal(
          (await request("/files/" + fileId, "GET", undefined, false)).status,
          401,
        );
        assert.equal((await request("/files/" + fileId)).status, 200);
        const photoCard = await (
          await request("/contacts", "POST", {
            ...blankCard(),
            name: "Photo Contact",
            portrait_id: fileId,
          })
        ).json();
        const shared = await (
          await request("/shares", "POST", {
            contact_id: photoCard.id,
            include_photo: true,
          })
        ).json();
        const hidden = await (
          await request("/shares", "POST", {
            contact_id: photoCard.id,
            include_photo: false,
          })
        ).json();
        assert.equal(
          (
            await request(
              "/public/" + shared.token + "/photo",
              "GET",
              undefined,
              false,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              "/public/" + hidden.token + "/photo",
              "GET",
              undefined,
              false,
            )
          ).status,
          404,
        );
        await request("/contacts/" + photoCard.id, "DELETE");
        assert.equal((await request("/files/" + fileId)).status, 404);
        assert.equal(
          (
            await request(
              "/public/" + shared.token + "/photo",
              "GET",
              undefined,
              false,
            )
          ).status,
          404,
        );
      },
    );
    await t.test(
      "conference follow-up persists, remains private and exports",
      async () => {
        assert.equal(
          (
            await request(
              "/conferences",
              "PUT",
              { name: "Private Conference", notes: "Private notes" },
              false,
            )
          ).status,
          401,
        );
        const saved = await (
          await request("/conferences", "PUT", {
            name: "Private Conference",
            notes: "Private notes",
            follow_up: "2026-11-01",
            next_action: "Prepare summary",
          })
        ).json();
        assert.ok(saved.id);
        const updated = await (
          await request("/conferences", "PUT", {
            name: "Private Conference",
            notes: "Updated",
            completed: true,
          })
        ).json();
        assert.equal(updated.id, saved.id);
        const rows = await (await request("/conferences")).json();
        assert.equal(rows.length, 1);
        assert.equal(rows[0].notes, "Updated");
        assert.equal(rows[0].completed, true);
        assert.equal(
          (await (await request("/export")).json()).conferences[0].notes,
          "Updated",
        );
        assert.equal(
          (await request("/conferences", "PUT", { name: "" })).status,
          400,
        );
      },
    );
    let id = "",
      share = "",
      profileToken = "";
    await t.test(
      "contact and CRM data persist without exposing private notes",
      async () => {
        const c = {
          ...blankCard(),
          name: "Test Person",
          company: "Test Company",
          email: "test@example.com",
          notes: "PRIVATE NOTE",
          event: "PRIVATE EVENT",
          follow_up: "2026-10-10",
          next_action: "PRIVATE ACTION",
        };
        const r = await request("/contacts", "POST", c);
        assert.equal(r.status, 201);
        id = (await r.json()).id;
        await request("/contacts/" + id + "/interactions", "POST", {
          kind: "Møde",
          happened_at: "2026-10-10",
          note: "PRIVATE INTERACTION",
        });
        assert.equal((await (await request("/contacts")).json()).length, 1);
        assert.equal(
          (await (await request("/contacts/" + id + "/interactions")).json())
            .length,
          1,
        );
      },
    );
    await t.test(
      "share uses an explicit snapshot and expires/revokes",
      async () => {
        const r = await request("/shares", "POST", {
          kind: "contact",
          contact_id: id,
          fields: ["name", "company"],
          days: 1,
        });
        share = (await r.json()).token;
        assert.equal(share.length, 64);
        const pub = await request("/public/" + share, "GET", undefined, false);
        assert.equal(pub.status, 200);
        const data = await pub.json();
        assert.equal(data.name, "Test Person");
        assert.equal(data.email, "");
        for (const k of [
          "notes",
          "event",
          "follow_up",
          "next_action",
          "photo_ids",
        ])
          assert.ok(!(k in data));
        const text = await (
          await request("/public/" + share + "/vcard", "GET", undefined, false)
        ).text();
        assert.ok(!text.includes("PRIVATE"));
        const changed = { ...blankCard(), name: "Changed", company: "Another" };
        await request("/contacts/" + id, "PUT", changed);
        assert.equal(
          (
            await (
              await request("/public/" + share, "GET", undefined, false)
            ).json()
          ).name,
          "Test Person",
        );
        await db
          .prepare("UPDATE shares SET expires_at=? WHERE token=?")
          .bind("2000-01-01T00:00:00.000Z", share)
          .run();
        assert.equal(
          (await request("/public/" + share, "GET", undefined, false)).status,
          404,
        );
      },
    );
    await t.test(
      "public profile updates live, while notes remain private",
      async () => {
        await request("/profile", "PUT", {
          ...blankCard(),
          name: "Owner",
          notes: "OWNER PRIVATE",
          email: "owner@example.com",
        });
        const r = await request("/shares", "POST", { kind: "profile" });
        profileToken = (await r.json()).token;
        assert.equal(
          (
            await (
              await request("/public/" + profileToken, "GET", undefined, false)
            ).json()
          ).name,
          "Owner",
        );
        await request("/profile", "PUT", {
          ...blankCard(),
          name: "Owner Updated",
          notes: "OWNER PRIVATE",
        });
        const data = await (
          await request("/public/" + profileToken, "GET", undefined, false)
        ).json();
        assert.equal(data.name, "Owner Updated");
        assert.ok(!("notes" in data));
        await request("/shares/" + profileToken, "DELETE");
        assert.equal(
          (await request("/public/" + profileToken, "GET", undefined, false))
            .status,
          404,
        );
      },
    );
    await t.test(
      "deleting contact removes historical records and shares",
      async () => {
        await request("/contacts/" + id, "DELETE");
        assert.equal((await request("/contacts/" + id)).status, 404);
        assert.equal(
          (await db.prepare("SELECT COUNT(*) n FROM interactions").first()).n,
          0,
        );
        assert.equal(
          (await request("/public/" + share, "GET", undefined, false)).status,
          404,
        );
      },
    );
    await t.test("login rate limiting is enforced", async () => {
      for (let i = 0; i < 10; i++)
        assert.equal(
          (await request("/login", "POST", { password: "wrong" })).status,
          401,
        );
      assert.equal((await request("/login", "POST", { password })).status, 429);
    });
  } finally {
    await mf.dispose();
  }
});
test("missing secrets leave app closed", async () => {
  const bundle = await build({
    entryPoints: ["worker/index.ts"],
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
  });
  const mf = new Miniflare({
    workers: [
      {
        name: "app",
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: "2025-09-01",
      },
    ],
  });
  try {
    const r = await mf.dispatchFetch("http://localhost/api/contacts");
    assert.equal(r.status, 503);
  } finally {
    await mf.dispose();
  }
});
