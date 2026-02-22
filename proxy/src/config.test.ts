import { describe, it, expect, vi } from "vitest";
import { validateConfig, LIMITS } from "./config.js";

describe("LIMITS", () => {
  it("has correct persistence timeout limits", () => {
    expect(LIMITS.PERSISTENCE_TIMEOUT.MIN).toBe(0);
    expect(LIMITS.PERSISTENCE_TIMEOUT.MAX).toBe(43200000); // 12 hours
    expect(LIMITS.PERSISTENCE_TIMEOUT.DEFAULT).toBe(600000); // 10 minutes
  });

  it("has correct buffer lines limits", () => {
    expect(LIMITS.BUFFER_LINES.MIN).toBe(10);
    expect(LIMITS.BUFFER_LINES.MAX).toBe(10000);
    expect(LIMITS.BUFFER_LINES.DEFAULT).toBe(1000);
  });
});

describe("validateConfig", () => {
  const limits = { MIN: 10, MAX: 100, DEFAULT: 50 };

  it("passes through a valid value within range", () => {
    expect(validateConfig(42, limits, "test")).toBe(42);
  });

  it("passes through the minimum value", () => {
    expect(validateConfig(10, limits, "test")).toBe(10);
  });

  it("passes through the maximum value", () => {
    expect(validateConfig(100, limits, "test")).toBe(100);
  });

  it("returns default for NaN", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(validateConfig(NaN, limits, "test")).toBe(50);
    spy.mockRestore();
  });

  it("clamps below minimum", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(validateConfig(5, limits, "test")).toBe(10);
    spy.mockRestore();
  });

  it("clamps above maximum", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(validateConfig(200, limits, "test")).toBe(100);
    spy.mockRestore();
  });

  it("logs a warning when value is NaN", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateConfig(NaN, limits, "myParam");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("myParam")
    );
    spy.mockRestore();
  });

  it("logs a warning when clamping", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateConfig(-1, limits, "myParam");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("myParam"),
    );
    spy.mockRestore();
  });
});
