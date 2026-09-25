import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PdfExportButton } from "./PdfExportButton";

function mockFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  } as unknown as Response);
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "PDF exportieren" }));
}

function requestedUrl(fetchMock: ReturnType<typeof mockFetch>): string {
  return String(fetchMock.mock.calls[0][0]);
}

describe("PdfExportButton", () => {
  beforeEach(() => {
    // Der Browser-Zweig legt einen Blob-Download an.
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("blendet die Wochenauswahl erst ein, wenn der Wochenbericht gewählt ist", () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<PdfExportButton seasonId={1} seasonLabel="Test" maxWeek={10} />);
    open();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Wettkampfwoche" }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("bietet jede Wettkampfwoche plus 'Alle Wochen' an und wählt die letzte vor", () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<PdfExportButton seasonId={1} seasonLabel="Test" maxWeek={10} />);
    open();
    fireEvent.click(screen.getByRole("checkbox", { name: "Wettkampfwoche" }));

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    // 10 Wochen + "Alle Wochen"
    expect(select.options).toHaveLength(11);
    expect(select.options[0].text).toBe("Alle Wochen");
    // Der Wochenbericht wird fast immer für den zuletzt gespielten Wettkampf gebraucht.
    expect(select.value).toBe("10");
  });

  it("übergibt 'Alle Wochen' als week=all an den Export", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<PdfExportButton seasonId={7} seasonLabel="Test" maxWeek={10} />);
    open();
    fireEvent.click(screen.getByRole("checkbox", { name: "Wettkampfwoche" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });
    fireEvent.click(screen.getByRole("button", { name: "Herunterladen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(requestedUrl(fetchMock)).toContain("week=all");
  });

  it("übergibt die gewählte Woche an den Export", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<PdfExportButton seasonId={7} seasonLabel="Test" maxWeek={10} />);
    open();
    fireEvent.click(screen.getByRole("checkbox", { name: "Wettkampfwoche" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Herunterladen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = requestedUrl(fetchMock);
    expect(url).toContain("/seasons/7/pdf");
    expect(url).toContain("week=3");
    expect(url).toContain("sections=");
  });

  it("hängt keine Woche an, wenn der Wochenbericht nicht gewählt ist", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<PdfExportButton seasonId={1} seasonLabel="Test" maxWeek={10} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Herunterladen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(requestedUrl(fetchMock)).not.toContain("week=");
  });

  it("verlangt mindestens einen Abschnitt", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<PdfExportButton seasonId={1} seasonLabel="Test" maxWeek={4} />);
    open();
    for (const box of screen.getAllByRole("checkbox")) {
      if ((box as HTMLInputElement).checked) fireEvent.click(box);
    }
    fireEvent.click(screen.getByRole("button", { name: "Herunterladen" }));

    expect(await screen.findByText("Bitte mindestens einen Abschnitt auswählen.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
