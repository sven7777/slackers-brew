import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

// React logs caught errors to console.error; silence it so a passing run is
// readable.
beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

const Boom = ({ explode }) => {
  if (explode) throw new Error("recs[selR] is undefined");
  return <div>panel content</div>;
};

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Boom explode={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("panel content")).toBeInTheDocument();
  });

  it("shows a fallback instead of a blank page when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom explode={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong here.")).toBeInTheDocument();
    expect(screen.queryByText("panel content")).not.toBeInTheDocument();
  });

  it("reassures that stored data is intact", () => {
    render(
      <ErrorBoundary>
        <Boom explode={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText(/saved data hasn’t been touched/i)).toBeInTheDocument();
  });

  it("surfaces the underlying error for debugging", () => {
    render(
      <ErrorBoundary>
        <Boom explode={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText(/recs\[selR\] is undefined/)).toBeInTheDocument();
  });

  it("shows a custom hint when given one", () => {
    render(
      <ErrorBoundary hint="Reload the page to start over.">
        <Boom explode={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Reload the page to start over.")).toBeInTheDocument();
  });

  it("re-renders children after Try again once the cause is gone", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Boom explode={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Whatever made it throw is fixed (e.g. selR snapped back in range).
    rerender(
      <ErrorBoundary>
        <Boom explode={false} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("panel content")).toBeInTheDocument();
  });
});
