import { describe, it, expect } from "vitest";

describe("セットアップ確認", () => {
  it("Vitestが動作すること", () => {
    expect(1 + 1).toBe(2);
  });

  it("文字列の結合", () => {
    expect("営業" + "日報").toBe("営業日報");
  });
});
