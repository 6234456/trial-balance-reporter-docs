import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";

const rootPath = resolve(import.meta.dirname, "..");

describe("App", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
    });
  });

  it("renders the milestone zero application shell", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("trial-balance-reporter");
    expect(html).toContain("All Excel processing stays in your browser");
    expect(html).toContain("Load Demo");
    expect(html).toContain("Upload Excel");
    expect(html).toContain("Upload");
    expect(html).toContain("Validate");
    expect(html).toContain("Configure");
    expect(html).toContain("Preview");
    expect(html).toContain("Export");
  });

  it("loads the bundled demo workbook into the MVP workspace", async () => {
    const workbook = readFileSync(resolve(rootPath, "public/examples/sample-valid.xlsx"));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => workbook.buffer.slice(workbook.byteOffset, workbook.byteOffset + workbook.byteLength),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<App />);
    });

    const loadDemoButton = [...host.querySelectorAll("button")].find((button) => button.textContent === "Load Demo");
    expect(loadDemoButton).toBeTruthy();

    await act(async () => {
      loadDemoButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitForText(host, "Workbook ready");

    expect(fetchMock).toHaveBeenCalledWith("./examples/sample-valid.xlsx");
    expect(host.textContent).toContain("Balance Sheet");
    expect(host.textContent).toContain("Profit or Loss - YTD");
    expect(host.textContent).toContain("D3 Charts");
    expect(host.textContent).toContain("Executive KPIs");
    expect(host.textContent).toContain("Export Reveal HTML");
    expect(host.querySelector("svg")).toBeTruthy();

    root.unmount();
    host.remove();
  });
});

async function waitForText(element: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (element.textContent?.includes(text)) {
      return;
    }
    await act(async () => {
      await new Promise((resolveWait) => setTimeout(resolveWait, 10));
    });
  }

  throw new Error(`Timed out waiting for text: ${text}`);
}
