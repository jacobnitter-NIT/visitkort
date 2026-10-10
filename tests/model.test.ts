import test from "node:test";
import assert from "node:assert/strict";
import {
  blankCard,
  parseQR,
  vcard,
  csv,
  sanitizeCard,
  safeWeb,
} from "../src/model.ts";
test("vCard roundtrip supports Unicode, escaped delimiters and folding", () => {
  const c = {
    ...blankCard(),
    name: "Sørensen, Jacob; CEO",
    company: "Selskab med et langt navn æøå ".repeat(5),
    email: "jacob@example.com",
    phone: "+299 123456",
    mobile: "+45 12345678",
    address: "Nuuk; Grønland, 3900",
    notes: "PRIVATE",
  };
  const v = vcard(c);
  for (const line of v.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  const parsed = parseQR(v);
  for (const key of [
    "name",
    "company",
    "email",
    "phone",
    "mobile",
    "address",
  ] as const)
    assert.equal(parsed[key], c[key]);
  assert.ok(!v.includes("PRIVATE"));
});
test("MeCard and safe web QR supported", () => {
  const c = parseQR(
    "MECARD:N:Sørensen,Jacob;TEL:+299123456;EMAIL:j@example.com;ORG:Air;",
  );
  assert.equal(c.name, "Jacob Sørensen");
  assert.equal(c.company, "Air");
  assert.equal(
    parseQR("https://example.com/profile").website,
    "https://example.com/profile",
  );
  assert.throws(() => parseQR("random text"));
});
test("untrusted fields are whitelisted and spreadsheet formulas are escaped", () => {
  const c = sanitizeCard({
    name: "=1+1",
    tags: ["a", 5],
    notes: "private",
    admin: true,
  });
  assert.deepEqual(c.tags, ["a"]);
  assert.ok(!("admin" in c));
  assert.ok(csv([c]).includes("'=1+1"));
  assert.equal(safeWeb("javascript:alert(1)"), "");
});
