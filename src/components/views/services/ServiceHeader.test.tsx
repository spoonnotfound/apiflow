import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ServiceHeader } from "./ServiceHeader";
import { ServiceConfig } from "@/types";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Copy: () => <span data-testid="icon-copy">Copy</span>,
  Check: () => <span data-testid="icon-check">Check</span>,
  Trash2: () => <span data-testid="icon-trash">Trash</span>,
}));

describe("ServiceHeader", () => {
  const mockService: ServiceConfig = {
    id: "1",
    name: "Test Service",
    basePath: "/test",
    enabled: true,
  };

  it("renders service name and switch", () => {
    render(
      <ServiceHeader
        service={mockService}
        addressOptions={[]}
        copiedUrl={null}
        onCopyUrl={vi.fn()}
        onToggleEnabled={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Test Service")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("calls onToggleEnabled when switch is clicked", () => {
    const onToggle = vi.fn();
    render(
      <ServiceHeader
        service={mockService}
        addressOptions={[]}
        copiedUrl={null}
        onCopyUrl={vi.fn()}
        onToggleEnabled={onToggle}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(
      <ServiceHeader
        service={mockService}
        addressOptions={[]}
        copiedUrl={null}
        onCopyUrl={vi.fn()}
        onToggleEnabled={vi.fn()}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByTestId("icon-trash").closest("button")!);
    expect(onDelete).toHaveBeenCalled();
  });
});
