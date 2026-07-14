import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Drive the hook through the repo seam so we control sync vs async behavior.
const load = vi.fn();
const save = vi.fn();
vi.mock("../lib/repo", () => ({
  load: (...a) => load(...a),
  save: (...a) => save(...a),
}));

import { usePersistentState } from "./usePersistentState";

beforeEach(() => {
  load.mockReset();
  save.mockReset();
});

describe("sync backend (localStorage)", () => {
  it("hydrates immediately with no loading state", () => {
    load.mockReturnValue(42);
    const { result } = renderHook(() => usePersistentState("tab", 0));
    expect(result.current[0]).toBe(42);
    expect(result.current[2]).toEqual({ loading: false, error: null });
  });

  it("does not write the hydrated value back, but persists later changes", async () => {
    load.mockReturnValue(1);
    const { result } = renderHook(() => usePersistentState("tab", 0));
    expect(save).not.toHaveBeenCalled(); // hydration write-back suppressed
    act(() => result.current[1](2));
    await waitFor(() => expect(save).toHaveBeenCalledWith("tab", 2)); // saves are chained, so async
  });

  it("supports functional updates", () => {
    load.mockReturnValue(5);
    const { result } = renderHook(() => usePersistentState("n", 0));
    act(() => result.current[1]((v) => v + 1));
    expect(result.current[0]).toBe(6);
  });
});

describe("async backend (Supabase)", () => {
  it("starts from the fallback in a loading state, then fills in", async () => {
    load.mockReturnValue(Promise.resolve(["loaded"]));
    const { result } = renderHook(() => usePersistentState("malts", () => ["fb"]));
    expect(result.current[0]).toEqual(["fb"]);
    expect(result.current[2].loading).toBe(true);
    await waitFor(() => expect(result.current[2].loading).toBe(false));
    expect(result.current[0]).toEqual(["loaded"]);
    expect(save).not.toHaveBeenCalled(); // no write-back of the loaded value
  });

  it("surfaces a load error and never persists over real data", async () => {
    load.mockReturnValue(Promise.reject(new Error("offline")));
    const { result } = renderHook(() => usePersistentState("malts", () => ["fb"]));
    await waitFor(() => expect(result.current[2].error).toBeTruthy());
    expect(result.current[2].loading).toBe(false);
    act(() => result.current[1](["edited"])); // even an edit must not save while errored
    expect(save).not.toHaveBeenCalled();
  });
});

describe("save serialization", () => {
  // Regression for the 2026-07-14 recipe-doubling incident: an async save is a
  // delete-then-insert, so two saves in flight at once can interleave their
  // phases and duplicate every row. Saves must run one at a time, and a burst
  // of edits must coalesce to the newest value instead of replaying each step.
  it("never overlaps saves and coalesces a burst of edits to the newest value", async () => {
    load.mockReturnValue(0); // sync hydrate so edits persist immediately
    let inFlight = 0, maxInFlight = 0;
    const resolvers = [];
    save.mockImplementation(() => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise((res) => resolvers.push(() => { inFlight--; res(); }));
    });

    const { result } = renderHook(() => usePersistentState("recipes", 0));
    act(() => result.current[1](1));
    act(() => result.current[1](2));
    act(() => result.current[1](3));

    await waitFor(() => expect(save).toHaveBeenCalled());
    while (resolvers.length) {
      resolvers.shift()();
      await act(async () => {}); // flush the chained save's microtasks
    }

    expect(maxInFlight).toBe(1);
    expect(save.mock.calls.at(-1)[1]).toBe(3); // newest value wins
    expect(save.mock.calls.length).toBeLessThanOrEqual(2); // burst coalesced
  });

  it("keeps saving after one save fails", async () => {
    load.mockReturnValue(0);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    save.mockReturnValueOnce(Promise.reject(new Error("network")));
    save.mockReturnValue(Promise.resolve());

    const { result } = renderHook(() => usePersistentState("recipes", 0));
    act(() => result.current[1](1));
    await act(async () => {}); // let the failing save settle
    act(() => result.current[1](2));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith("recipes", 2));
    consoleError.mockRestore();
  });
});
