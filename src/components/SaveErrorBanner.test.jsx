import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import SaveErrorBanner from "./SaveErrorBanner";
import { reportFailure, clearFailure, resetFailures } from "../lib/saveStatus";

beforeEach(() => act(() => resetFailures()));

describe("SaveErrorBanner", () => {
  it("renders nothing when every save is healthy", () => {
    const { container } = render(<SaveErrorBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("warns that the on-screen change will be lost, using a human label", () => {
    render(<SaveErrorBanner />);
    act(() => reportFailure("recipes", new Error("duplicate key"), vi.fn()));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Recipes didn’t save/)).toBeInTheDocument();
    expect(screen.getByText(/lost if you reload/)).toBeInTheDocument();
    expect(screen.getByText("duplicate key")).toBeInTheDocument();
  });

  it("retries the failed write on demand", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    render(<SaveErrorBanner />);
    act(() => reportFailure("malts", new Error("offline"), retry));
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
  });

  it("disappears once the write succeeds", async () => {
    render(<SaveErrorBanner />);
    act(() => reportFailure("malts", new Error("offline"), vi.fn()));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // The hook clears the key after a successful save.
    act(() => clearFailure("malts"));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("lists one row per failing key", () => {
    render(<SaveErrorBanner />);
    act(() => {
      reportFailure("recipes", new Error("a"), vi.fn());
      reportFailure("settings", new Error("b"), vi.fn());
    });
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getByText(/Recipes didn’t save/)).toBeInTheDocument();
    expect(screen.getByText(/Settings didn’t save/)).toBeInTheDocument();
  });
});
