import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubmitButton } from "./FormPrimitives";

describe("SubmitButton", () => {
  it("renders the default label when none is provided", () => {
    render(<SubmitButton onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("renders a custom label", () => {
    render(<SubmitButton onClick={() => {}} label="IN" />);
    expect(screen.getByRole("button", { name: "IN" })).toBeInTheDocument();
  });

  it("calls onClick when clicked and enabled", () => {
    const onClick = vi.fn();
    render(<SubmitButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(<SubmitButton onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is disabled via the native disabled attribute, not just visually", () => {
    render(<SubmitButton onClick={() => {}} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
