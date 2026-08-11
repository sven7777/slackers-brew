import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  subscribe,
  getFailures,
  reportFailure,
  clearFailure,
  resetFailures,
} from "./saveStatus";

beforeEach(() => resetFailures());

describe("saveStatus store", () => {
  it("records a failure and notifies subscribers", () => {
    const listener = vi.fn();
    subscribe(listener);
    reportFailure("recipes", new Error("duplicate key"), vi.fn());
    expect(listener).toHaveBeenCalled();
    expect(getFailures()).toHaveLength(1);
    expect(getFailures()[0].key).toBe("recipes");
  });

  it("keeps only the newest failure per key", () => {
    reportFailure("recipes", new Error("first"), vi.fn());
    reportFailure("recipes", new Error("second"), vi.fn());
    expect(getFailures()).toHaveLength(1);
    expect(getFailures()[0].error.message).toBe("second");
  });

  it("tracks different keys independently", () => {
    reportFailure("recipes", new Error("a"), vi.fn());
    reportFailure("malts", new Error("b"), vi.fn());
    expect(getFailures().map((f) => f.key)).toEqual(["recipes", "malts"]);
    clearFailure("recipes");
    expect(getFailures().map((f) => f.key)).toEqual(["malts"]);
  });

  it("keeps snapshot identity stable when clearing an unknown key", () => {
    reportFailure("recipes", new Error("a"), vi.fn());
    const before = getFailures();
    const listener = vi.fn();
    subscribe(listener);
    clearFailure("malts"); // never failed
    // Identity must not change, or useSyncExternalStore re-renders on every
    // successful save of every other key.
    expect(getFailures()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    unsub();
    reportFailure("recipes", new Error("a"), vi.fn());
    expect(listener).not.toHaveBeenCalled();
  });
});
