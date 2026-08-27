import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import SaveErrorBanner from "./SaveErrorBanner";
import { reportFailure, clearFailure, resetFailures } from "../lib/saveStatus";
import { StaleWriteError } from '../lib/staleWrite';

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

// A refused write is not a failed write. Retrying a stale save is exactly the
// act of overwriting somebody else's newer data — the thing migration 0014
// exists to prevent — so this variant must never offer it.
describe('SaveErrorBanner on a refused (stale) write', () => {
  it('says the page is out of date and offers Reload, not Retry', () => {
    const retry = vi.fn();
    const onReload = vi.fn();
    reportFailure('recipes', new StaleWriteError('recipes'), retry);
    render(<SaveErrorBanner onReload={onReload} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/out of date/i);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();  // never the retry
  });

  it('warns that the unsaved edit goes with the reload', () => {
    reportFailure('malts', new StaleWriteError('malts'), vi.fn());
    render(<SaveErrorBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent(/edit you just made will be lost/i);
  });

  it('still offers Retry for an ordinary failure', () => {
    reportFailure('hops', new Error('network died'), vi.fn());
    render(<SaveErrorBanner />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
