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

  it("does not write the hydrated value back, but persists later changes", () => {
    load.mockReturnValue(1);
    const { result } = renderHook(() => usePersistentState("tab", 0));
    expect(save).not.toHaveBeenCalled(); // hydration write-back suppressed
    act(() => result.current[1](2));
    expect(save).toHaveBeenCalledWith("tab", 2);
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
