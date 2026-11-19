// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  other: "00000000-0000-4000-8000-000000000002",
  admin: "00000000-0000-4000-8000-000000000003",
  member: "00000000-0000-4000-8000-000000000004",
  stranger: "00000000-0000-4000-8000-000000000005",
};
const companyA = "10000000-0000-4000-8000-000000000001";
const companyB = "10000000-0000-4000-8000-000000000002";
let db: PGlite;
async function actor(id: string) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("SET ROLE authenticated");
}
async function scalar<T = string>(sql: string, params: unknown[] = []) {
  const result = await db.query<{ value: T }>(sql, params);
  return result.rows[0]?.value;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;`);
  for (const [name, id] of Object.entries(ids))
    await db.query("INSERT INTO auth.users VALUES($1,$2,now())", [id, `${name}@example.test`]);
  await db.exec(readFileSync("drizzle/migrations/0000_migration.sql", "utf8"));
  await db.query("INSERT INTO companies(id,owner_id,name) VALUES($1,$2,$3),($4,$5,$6)", [
    companyA,
    ids.owner,
    "A",
    companyB,
    ids.other,
    "B",
  ]);
  await db.exec(readFileSync("database/proposals/001_security_foundation.sql", "utf8"));
  await db.query(
    "INSERT INTO company_members(company_id,user_id,role) VALUES($1,$2,'admin'),($1,$3,'member')",
    [companyA, ids.admin, ids.member],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("Proposed migration on PostgreSQL (PGlite)", () => {
  it("backfills owners and isolates reads, inserts, updates and deletes across companies", async () => {
    await actor(ids.owner);
    expect(await scalar<number>("SELECT count(*)::int AS value FROM companies")).toBe(1);
    expect(await scalar("SELECT role AS value FROM company_members WHERE user_id=auth.uid()")).toBe(
      "owner",
    );
    await expect(
      db.query("INSERT INTO operations(company_id,title) VALUES($1,'forbidden')", [companyB]),
    ).rejects.toThrow();
    await actor(ids.other);
    const op = await scalar(
      "INSERT INTO operations(company_id,title) VALUES($1,'private') RETURNING id AS value",
      [companyB],
    );
    await actor(ids.owner);
    expect(await scalar<number>("SELECT count(*)::int AS value FROM operations")).toBe(0);
    expect(
      (await db.query("UPDATE operations SET title=$1 WHERE id=$2 RETURNING id", ["hacked", op]))
        .rows,
    ).toHaveLength(0);
    expect(
      (await db.query("DELETE FROM operations WHERE id=$1 RETURNING id", [op])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("SELECT * FROM company_members WHERE company_id=$1", [companyB])).rows,
    ).toHaveLength(0);
  });
  it("allows member operations, reserves rule management and deletion for managers", async () => {
    await actor(ids.member);
    const op = await scalar(
      "INSERT INTO operations(company_id,title) VALUES($1,'member work') RETURNING id AS value",
      [companyA],
    );
    await db.query("UPDATE operations SET status='concluida' WHERE id=$1", [op]);
    expect(
      (await db.query("DELETE FROM operations WHERE id=$1 RETURNING id", [op])).rows,
    ).toHaveLength(0);
    await expect(
      db.query("INSERT INTO rules(company_id,name,metric,operator) VALUES($1,'bad','alta','>')", [
        companyA,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("INSERT INTO company_members(company_id,user_id,role) VALUES($1,$2,'owner')", [
        companyB,
        ids.member,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("SELECT set_company_member_role($1,$2,'admin')", [companyA, ids.member]),
    ).rejects.toThrow();
    await actor(ids.admin);
    await db.query(
      "INSERT INTO rules(company_id,name,metric,operator) VALUES($1,'good','alta','>')",
      [companyA],
    );
    expect(
      (await db.query("DELETE FROM operations WHERE id=$1 RETURNING id", [op])).rows,
    ).toHaveLength(1);
  });
  it("blocks moving rows between companies and replacing owner identity", async () => {
    await actor(ids.owner);
    const second = await scalar(
      "INSERT INTO companies(name) VALUES('second') RETURNING id AS value",
    );
    const op = await scalar(
      "INSERT INTO operations(company_id,title) VALUES($1,'fixed tenant') RETURNING id AS value",
      [companyA],
    );
    await expect(
      db.query("UPDATE operations SET company_id=$1 WHERE id=$2", [second, op]),
    ).rejects.toThrow("Immutable company");
    await expect(
      db.query("UPDATE companies SET owner_id=$1 WHERE id=$2", [ids.member, companyA]),
    ).rejects.toThrow();
    await expect(
      db.query("SELECT set_company_member_role($1,$2,'member')", [companyA, ids.owner]),
    ).rejects.toThrow();
    await expect(
      db.query("SELECT remove_company_member($1,$2)", [companyA, ids.owner]),
    ).rejects.toThrow();
  });
  it("binds single-use invitations to confirmed email and current inviter permissions", async () => {
    await actor(ids.owner);
    const token = await scalar(
      "SELECT create_company_invitation($1,'stranger@example.test','member') AS value",
      [companyA],
    );
    await actor(ids.other);
    await expect(db.query("SELECT accept_company_invitation($1)", [token])).rejects.toThrow(
      "Invalid invitation",
    );
    await actor(ids.stranger);
    expect(await scalar("SELECT accept_company_invitation($1) AS value", [token])).toBe(companyA);
    await expect(db.query("SELECT accept_company_invitation($1)", [token])).rejects.toThrow(
      "Invalid invitation",
    );
    await actor(ids.admin);
    await expect(
      db.query("SELECT create_company_invitation($1,'other@example.test','admin')", [companyA]),
    ).rejects.toThrow("Forbidden");
    const revoked = await scalar(
      "SELECT create_company_invitation($1,'other@example.test','member') AS value",
      [companyA],
    );
    await db.query("SELECT revoke_company_invitation($1)", [revoked]);
    await actor(ids.other);
    await expect(db.query("SELECT accept_company_invitation($1)", [revoked])).rejects.toThrow(
      "Invalid invitation",
    );
  });
  it("denies cross-company rule writes and company edits, and owner role changes take effect", async () => {
    await actor(ids.other);
    const rule = await scalar(
      "INSERT INTO rules(company_id,name,metric,operator) VALUES($1,'private rule','alta','>') RETURNING id AS value",
      [companyB],
    );
    await actor(ids.owner);
    expect(
      (await db.query("UPDATE rules SET name='bad' WHERE id=$1 RETURNING id", [rule])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("DELETE FROM rules WHERE id=$1 RETURNING id", [rule])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("UPDATE companies SET name='bad' WHERE id=$1 RETURNING id", [companyB])).rows,
    ).toHaveLength(0);
    await db.query("SELECT set_company_member_role($1,$2,'admin')", [companyA, ids.member]);
    await actor(ids.member);
    await db.query(
      "INSERT INTO rules(company_id,name,metric,operator) VALUES($1,'promoted','alta','>')",
      [companyA],
    );
    await actor(ids.owner);
    await db.query("SELECT set_company_member_role($1,$2,'member')", [companyA, ids.member]);
    await actor(ids.member);
    expect(
      (
        await db.query("UPDATE rules SET name='denied' WHERE company_id=$1 RETURNING id", [
          companyA,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("DELETE FROM rules WHERE company_id=$1 RETURNING id", [companyA])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("UPDATE companies SET name='denied' WHERE id=$1 RETURNING id", [companyA]))
        .rows,
    ).toHaveLength(0);
  });
  it("rejects expired invitations, unconfirmed accounts and removed inviters", async () => {
    await actor(ids.admin);
    const expired = await scalar(
      "SELECT create_company_invitation($1,'other@example.test','member') AS value",
      [companyA],
    );
    const removed = await scalar(
      "SELECT create_company_invitation($1,'other@example.test','member') AS value",
      [companyA],
    );
    await db.exec("RESET ROLE");
    await db.query("UPDATE company_invitations SET expires_at=now()-interval '1 day' WHERE id=$1", [
      expired,
    ]);
    await db.query("UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1", [ids.other]);
    await actor(ids.other);
    await expect(db.query("SELECT accept_company_invitation($1)", [removed])).rejects.toThrow(
      "Confirmed account required",
    );
    await db.exec("RESET ROLE");
    await db.query("UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1", [ids.other]);
    await actor(ids.other);
    await expect(db.query("SELECT accept_company_invitation($1)", [expired])).rejects.toThrow(
      "Invalid invitation",
    );
    await actor(ids.owner);
    await db.query("SELECT remove_company_member($1,$2)", [companyA, ids.admin]);
    await actor(ids.other);
    await expect(db.query("SELECT accept_company_invitation($1)", [removed])).rejects.toThrow(
      "Invalid invitation",
    );
  });
  it("keeps audit append-only and private; denies anonymous RPC access", async () => {
    await actor(ids.owner);
    expect(await scalar<number>("SELECT count(*)::int AS value FROM audit_logs")).toBeGreaterThan(
      0,
    );
    await expect(db.exec("DELETE FROM audit_logs")).rejects.toThrow();
    await actor(ids.member);
    expect(await scalar<number>("SELECT count(*)::int AS value FROM audit_logs")).toBe(0);
    await expect(db.exec("SELECT * FROM company_invitations")).rejects.toThrow();
    await db.exec("RESET ROLE; SET ROLE anon");
    await expect(
      db.query("SELECT create_company_invitation($1,'x@example.test','member')", [companyA]),
    ).rejects.toThrow();
    await expect(db.exec("SELECT * FROM operations")).rejects.toThrow();
  });
});
