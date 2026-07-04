import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UpdateNotice } from "./UpdateNotice";

const checkMock = vi.fn();
const relaunchMock = vi.fn();
vi.mock("@tauri-apps/plugin-updater", () => ({ check: () => checkMock() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: () => relaunchMock() }));

function markAsTauri() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
}
function unmarkTauri() {
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

describe("UpdateNotice", () => {
  beforeEach(() => {
    checkMock.mockReset();
    relaunchMock.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => unmarkTauri());

  it("renders nothing and never checks outside Tauri", () => {
    const { container } = render(<UpdateNotice />);
    expect(container).toBeEmptyDOMElement();
    expect(checkMock).not.toHaveBeenCalled();
  });

  it("renders nothing when no update is available", async () => {
    markAsTauri();
    checkMock.mockResolvedValue(null);
    const { container } = render(<UpdateNotice />);
    await waitFor(() => expect(checkMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a dismissable notice for an optional update", async () => {
    markAsTauri();
    checkMock.mockResolvedValue({ version: "0.2.0", body: "Neue Features", downloadAndInstall: vi.fn() });
    render(<UpdateNotice />);

    expect(await screen.findByText(/neue Version \(0.2.0\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Später" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Später" }));
    expect(screen.queryByText(/neue Version/i)).not.toBeInTheDocument();
  });

  it("shows a non-dismissable notice for a [pflicht] update", async () => {
    markAsTauri();
    checkMock.mockResolvedValue({ version: "0.2.0", body: "Kritischer Fix [pflicht]", downloadAndInstall: vi.fn() });
    render(<UpdateNotice />);

    expect(await screen.findByText(/muss installiert werden/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Später" })).not.toBeInTheDocument();
  });

  it("downloads, installs and relaunches when clicking update", async () => {
    markAsTauri();
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    checkMock.mockResolvedValue({ version: "0.2.0", body: "", downloadAndInstall });
    render(<UpdateNotice />);

    fireEvent.click(await screen.findByRole("button", { name: "Jetzt aktualisieren" }));

    await waitFor(() => expect(downloadAndInstall).toHaveBeenCalled());
    await waitFor(() => expect(relaunchMock).toHaveBeenCalled());
  });

  it("stays silent when the update check throws (offline)", async () => {
    markAsTauri();
    checkMock.mockRejectedValue(new Error("offline"));
    const { container } = render(<UpdateNotice />);
    await waitFor(() => expect(checkMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
