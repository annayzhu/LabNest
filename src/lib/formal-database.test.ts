import { describe, expect, it } from "vitest";
import { formalDatabaseProblem } from "./formal-database";

const formal = "postgresql://labnest:labnest@localhost:5432/labnest?schema=public";

describe("formalDatabaseProblem", () => {
  it("stops a development server on the formal database", () => {
    expect(formalDatabaseProblem({ NODE_ENV: "development", DATABASE_URL: formal })).toContain("LABNEST_ALLOW_FORMAL_DATABASE=1");
  });

  it("lets a development server use a copy, or the formal database when allowed", () => {
    expect(formalDatabaseProblem({ NODE_ENV: "development", DATABASE_URL: formal.replace("/labnest?", "/labnest_inventory_20261030?") })).toBeUndefined();
    expect(formalDatabaseProblem({ NODE_ENV: "development", DATABASE_URL: formal, LABNEST_ALLOW_FORMAL_DATABASE: "1" })).toBeUndefined();
  });

  it("leaves 3001, scripts and tests alone", () => {
    expect(formalDatabaseProblem({ NODE_ENV: "production", DATABASE_URL: "postgresql://labnest:labnest@postgres:5432/labnest?schema=public" })).toBeUndefined();
    expect(formalDatabaseProblem({ DATABASE_URL: formal })).toBeUndefined();
    expect(formalDatabaseProblem({ NODE_ENV: "test", DATABASE_URL: formal })).toBeUndefined();
  });

  it("does not guess from a URL it cannot read", () => {
    expect(formalDatabaseProblem({ NODE_ENV: "development", DATABASE_URL: "not a url" })).toBeUndefined();
  });
});
