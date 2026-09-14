import { describe, it, expect } from "vitest";

/**
 * The company printed in a plan's footer comes from the build on a fresh workstation, so a
 * correct sheet needs no form filled in first. Parsing is what this pins down; the values
 * themselves live in the Dockerfile.
 */
function parseAddress(raw: string): string[] {
  return raw.split("|").map((l) => l.trim()).filter(Boolean);
}

describe("company address from the build", () => {
  it("splits one line per printed row and drops the empties", () => {
    expect(parseAddress("Musterstr. 1|12345 Musterstadt")).toEqual(["Musterstr. 1", "12345 Musterstadt"]);
    expect(parseAddress(" Musterstr. 1 | | 12345 Musterstadt ")).toEqual(["Musterstr. 1", "12345 Musterstadt"]);
  });

  it("treats an unset value as no address rather than one empty line", () => {
    expect(parseAddress("")).toEqual([]);
    expect(parseAddress("   ")).toEqual([]);
    expect(parseAddress("|||")).toEqual([]);
  });
});
