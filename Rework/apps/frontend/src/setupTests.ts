import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Without this, un-mounted components from a previous test stay in the
// jsdom document, so getByRole/getByText queries that expect one match
// (e.g. one "Anmelden" button) fail once more than one test has rendered.
afterEach(cleanup);
