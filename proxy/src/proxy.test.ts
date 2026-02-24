import { describe, it, expect, vi } from "vitest";
import {
  generateSessionId,
  validateConfigValue,
  parseSessionConfig,
  escapeEnvironData,
  buildNewEnvironResponse,
  buildNewEnvironInfo,
  buildWillNewEnviron,
  buildProxyProtocolHeader,
  TelnetEnvironHandler,
  getClientInfo,
  parseUpstreamUrl,
} from "./proxy.js";
import type { IncomingMessage } from "http";
import type { Socket } from "net";

// Telnet protocol constants (const enums are inlined, use raw values)
const IAC = 255;
const DO = 253;
const WILL = 251;
const SB = 250;
const SE = 240;
const NEW_ENVIRON = 39;

// NEW-ENVIRON subnegotiation constants
const IS = 0;
const SEND = 1;
const INFO = 2;
const VAR = 0;
const VALUE = 1;
const ESC = 2;
const USERVAR = 3;

// ── generateSessionId ───────────────────────────────────────────────

describe("generateSessionId", () => {
  it("returns a 24-character string", () => {
    expect(generateSessionId()).toHaveLength(24);
  });

  it("uses only lowercase alphanumeric characters", () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[a-z0-9]{24}$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));
    expect(ids.size).toBe(100);
  });
});

// ── validateConfigValue ─────────────────────────────────────────────

describe("validateConfigValue", () => {
  const limits = { MIN: 10, MAX: 1000, DEFAULT: 100 };

  it("returns the value when within range", () => {
    expect(validateConfigValue(500, limits)).toBe(500);
  });

  it("clamps below minimum", () => {
    expect(validateConfigValue(5, limits)).toBe(10);
  });

  it("clamps above maximum", () => {
    expect(validateConfigValue(2000, limits)).toBe(1000);
  });

  it("returns default for NaN", () => {
    expect(validateConfigValue(NaN, limits)).toBe(100);
  });

  it("returns default for undefined", () => {
    expect(validateConfigValue(undefined, limits)).toBe(100);
  });

  it("accepts the minimum boundary value", () => {
    expect(validateConfigValue(10, limits)).toBe(10);
  });

  it("accepts the maximum boundary value", () => {
    expect(validateConfigValue(1000, limits)).toBe(1000);
  });
});

// ── parseSessionConfig ──────────────────────────────────────────────

describe("parseSessionConfig", () => {
  const defaultConfig = {
    port: 3001,
    upstreamUrl: "tls://example.com:7443",
    persistenceTimeout: 600000,
    maxBufferLines: 1000,
    useProxyProtocol: false,
    rejectUnauthorizedUpstream: false,
  };

  it("returns defaults when no URL params provided", () => {
    const params = new URLSearchParams();
    const config = parseSessionConfig(params, defaultConfig);
    expect(config.persistenceTimeout).toBe(600000);
    expect(config.maxBufferLines).toBe(1000);
  });

  it("overrides persistenceTimeout from URL params", () => {
    const params = new URLSearchParams({ persistenceTimeout: "300000" });
    const config = parseSessionConfig(params, defaultConfig);
    expect(config.persistenceTimeout).toBe(300000);
  });

  it("overrides maxBufferLines from URL params", () => {
    const params = new URLSearchParams({ maxBufferLines: "500" });
    const config = parseSessionConfig(params, defaultConfig);
    expect(config.maxBufferLines).toBe(500);
  });

  it("clamps out-of-range persistenceTimeout", () => {
    const params = new URLSearchParams({ persistenceTimeout: "99999999" });
    const config = parseSessionConfig(params, defaultConfig);
    expect(config.persistenceTimeout).toBe(43200000); // MAX
  });

  it("clamps out-of-range maxBufferLines", () => {
    const params = new URLSearchParams({ maxBufferLines: "1" });
    const config = parseSessionConfig(params, defaultConfig);
    expect(config.maxBufferLines).toBe(10); // MIN
  });

  it("returns default for non-numeric params", () => {
    const params = new URLSearchParams({ persistenceTimeout: "abc" });
    const config = parseSessionConfig(params, defaultConfig);
    expect(config.persistenceTimeout).toBe(600000); // DEFAULT
  });
});

// ── escapeEnvironData ───────────────────────────────────────────────

describe("escapeEnvironData", () => {
  it("passes through safe ASCII data unchanged", () => {
    const input = Buffer.from("IPADDRESS", "ascii");
    const result = escapeEnvironData(input);
    expect(result).toEqual(input);
  });

  it("escapes IAC (255) bytes by doubling", () => {
    const input = Buffer.from([65, 255, 66]); // A, IAC, B
    const result = escapeEnvironData(input);
    expect(result).toEqual(Buffer.from([65, 255, 255, 66]));
  });

  it("escapes VAR (0) bytes with ESC prefix", () => {
    const input = Buffer.from([65, 0, 66]);
    const result = escapeEnvironData(input);
    expect(result).toEqual(Buffer.from([65, ESC, VAR, 66]));
  });

  it("escapes VALUE (1) bytes with ESC prefix", () => {
    const input = Buffer.from([65, 1, 66]);
    const result = escapeEnvironData(input);
    expect(result).toEqual(Buffer.from([65, ESC, VALUE, 66]));
  });

  it("escapes ESC (2) bytes with ESC prefix", () => {
    const input = Buffer.from([65, 2, 66]);
    const result = escapeEnvironData(input);
    expect(result).toEqual(Buffer.from([65, ESC, ESC, 66]));
  });

  it("escapes USERVAR (3) bytes with ESC prefix", () => {
    const input = Buffer.from([65, 3, 66]);
    const result = escapeEnvironData(input);
    expect(result).toEqual(Buffer.from([65, ESC, USERVAR, 66]));
  });

  it("handles empty buffer", () => {
    const result = escapeEnvironData(Buffer.alloc(0));
    expect(result).toEqual(Buffer.alloc(0));
  });
});

// ── buildNewEnvironResponse ─────────────────────────────────────────

describe("buildNewEnvironResponse", () => {
  it("builds correct IS response structure", () => {
    const result = buildNewEnvironResponse("IPADDRESS", "1.2.3.4");
    const bytes = [...result];

    // IAC SB NEW_ENVIRON IS VAR ... VALUE ... IAC SE
    expect(bytes[0]).toBe(IAC);
    expect(bytes[1]).toBe(SB);
    expect(bytes[2]).toBe(NEW_ENVIRON);
    expect(bytes[3]).toBe(IS);
    expect(bytes[4]).toBe(VAR);

    // Find VALUE separator
    const varName = "IPADDRESS";
    const valueIdx = 5 + varName.length;
    expect(bytes[valueIdx]).toBe(VALUE);

    // Check value
    const value = "1.2.3.4";
    const valueBytes = bytes.slice(valueIdx + 1, valueIdx + 1 + value.length);
    expect(Buffer.from(valueBytes).toString("ascii")).toBe(value);

    // Check IAC SE at end
    expect(bytes[bytes.length - 2]).toBe(IAC);
    expect(bytes[bytes.length - 1]).toBe(SE);
  });

  it("uses IS (0) command byte, not INFO", () => {
    const result = buildNewEnvironResponse("X", "Y");
    expect(result[3]).toBe(IS);
  });
});

// ── buildNewEnvironInfo ─────────────────────────────────────────────

describe("buildNewEnvironInfo", () => {
  it("builds correct INFO response structure", () => {
    const result = buildNewEnvironInfo("IPADDRESS", "1.2.3.4");
    const bytes = [...result];

    expect(bytes[0]).toBe(IAC);
    expect(bytes[1]).toBe(SB);
    expect(bytes[2]).toBe(NEW_ENVIRON);
    expect(bytes[3]).toBe(INFO);
    expect(bytes[4]).toBe(VAR);
    expect(bytes[bytes.length - 2]).toBe(IAC);
    expect(bytes[bytes.length - 1]).toBe(SE);
  });

  it("uses INFO (2) command byte, not IS", () => {
    const result = buildNewEnvironInfo("X", "Y");
    expect(result[3]).toBe(INFO);
  });
});

// ── buildWillNewEnviron ─────────────────────────────────────────────

describe("buildWillNewEnviron", () => {
  it("returns IAC WILL NEW_ENVIRON", () => {
    const result = buildWillNewEnviron();
    expect([...result]).toEqual([IAC, WILL, NEW_ENVIRON]);
  });

  it("has length 3", () => {
    expect(buildWillNewEnviron()).toHaveLength(3);
  });
});

// ── buildProxyProtocolHeader ────────────────────────────────────────

describe("buildProxyProtocolHeader", () => {
  it("builds correct IPv4 header", () => {
    const result = buildProxyProtocolHeader("1.2.3.4", "5.6.7.8", 12345, 7443);
    const str = result.toString("ascii");
    expect(str).toBe("PROXY TCP4 1.2.3.4 5.6.7.8 12345 7443\r\n");
  });

  it("builds correct IPv6 header", () => {
    const result = buildProxyProtocolHeader(
      "::1",
      "::2",
      12345,
      7443
    );
    const str = result.toString("ascii");
    expect(str).toBe("PROXY TCP6 ::1 ::2 12345 7443\r\n");
  });

  it("terminates with CRLF", () => {
    const result = buildProxyProtocolHeader("1.2.3.4", "5.6.7.8", 1, 2);
    const str = result.toString("ascii");
    expect(str.endsWith("\r\n")).toBe(true);
  });

  it("uses TCP4 for IPv4 addresses", () => {
    const result = buildProxyProtocolHeader("192.168.1.1", "10.0.0.1", 1, 2);
    expect(result.toString("ascii")).toContain("TCP4");
  });

  it("uses TCP6 for IPv6 addresses", () => {
    const result = buildProxyProtocolHeader(
      "2001:db8::1",
      "2001:db8::2",
      1,
      2
    );
    expect(result.toString("ascii")).toContain("TCP6");
  });
});

// ── TelnetEnvironHandler ────────────────────────────────────────────

describe("TelnetEnvironHandler", () => {
  it("starts as not negotiated", () => {
    const handler = new TelnetEnvironHandler("1.2.3.4");
    expect(handler.isNegotiated()).toBe(false);
  });

  it("updates client IP via setClientIp", () => {
    const handler = new TelnetEnvironHandler("1.2.3.4");
    handler.setClientIp("5.6.7.8");
    // Verify by checking the INFO message contains the new IP
    const info = handler.buildIpInfoMessage();
    expect(info.toString("ascii")).toContain("5.6.7.8");
  });

  describe("processUpstreamData", () => {
    it("responds WILL to DO NEW_ENVIRON and sets negotiated", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const handler = new TelnetEnvironHandler("1.2.3.4");
      const doNewEnviron = Buffer.from([IAC, DO, NEW_ENVIRON]);

      const result = handler.processUpstreamData(doNewEnviron);

      expect(handler.isNegotiated()).toBe(true);
      expect(result.response).not.toBeNull();
      expect([...result.response!]).toEqual([IAC, WILL, NEW_ENVIRON]);
      expect(result.passThrough).toHaveLength(0);
      vi.restoreAllMocks();
    });

    it("responds with IS containing IP to SB NEW_ENVIRON SEND", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const handler = new TelnetEnvironHandler("10.0.0.1");

      // First negotiate
      handler.processUpstreamData(Buffer.from([IAC, DO, NEW_ENVIRON]));

      // Then receive SEND for IPADDRESS
      // IAC SB NEW_ENVIRON SEND VAR "IPADDRESS" IAC SE
      const varName = Buffer.from("IPADDRESS", "ascii");
      const sendBuf = Buffer.from([
        IAC, SB, NEW_ENVIRON, SEND, VAR,
        ...varName,
        IAC, SE,
      ]);

      const result = handler.processUpstreamData(sendBuf);

      expect(result.response).not.toBeNull();
      const resp = [...result.response!];
      // Should be IAC SB NEW_ENVIRON IS VAR IPADDRESS VALUE 10.0.0.1 IAC SE
      expect(resp[0]).toBe(IAC);
      expect(resp[1]).toBe(SB);
      expect(resp[2]).toBe(NEW_ENVIRON);
      expect(resp[3]).toBe(IS);
      expect(result.response!.toString("ascii")).toContain("10.0.0.1");
      vi.restoreAllMocks();
    });

    it("responds with IS when SEND has no specific variables", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const handler = new TelnetEnvironHandler("10.0.0.1");
      handler.processUpstreamData(Buffer.from([IAC, DO, NEW_ENVIRON]));

      // SEND with no variable names = "send all"
      const sendBuf = Buffer.from([IAC, SB, NEW_ENVIRON, SEND, IAC, SE]);
      const result = handler.processUpstreamData(sendBuf);

      expect(result.response).not.toBeNull();
      expect(result.response!.toString("ascii")).toContain("IPADDRESS");
      expect(result.response!.toString("ascii")).toContain("10.0.0.1");
      vi.restoreAllMocks();
    });

    it("passes through non-NEW_ENVIRON data unchanged", () => {
      const handler = new TelnetEnvironHandler("1.2.3.4");
      const plainData = Buffer.from("Hello, world!", "ascii");

      const result = handler.processUpstreamData(plainData);

      expect(result.response).toBeNull();
      expect(result.passThrough).toEqual(plainData);
    });

    it("passes through non-NEW_ENVIRON telnet commands", () => {
      const handler = new TelnetEnvironHandler("1.2.3.4");
      // IAC DO ECHO (option 1)
      const telnetCmd = Buffer.from([IAC, DO, 1]);

      const result = handler.processUpstreamData(telnetCmd);

      expect(result.response).toBeNull();
      expect(result.passThrough).toEqual(telnetCmd);
    });

    it("handles split packets across multiple calls", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const handler = new TelnetEnvironHandler("1.2.3.4");

      // Split IAC DO NEW_ENVIRON across two packets
      const part1 = Buffer.from([IAC]);
      const part2 = Buffer.from([DO, NEW_ENVIRON]);

      const result1 = handler.processUpstreamData(part1);
      expect(result1.response).toBeNull();
      expect(result1.passThrough).toHaveLength(0);

      const result2 = handler.processUpstreamData(part2);
      expect(handler.isNegotiated()).toBe(true);
      expect(result2.response).not.toBeNull();
      expect([...result2.response!]).toEqual([IAC, WILL, NEW_ENVIRON]);
      vi.restoreAllMocks();
    });

    it("handles mixed telnet commands and regular data", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const handler = new TelnetEnvironHandler("1.2.3.4");

      // Regular data + IAC DO NEW_ENVIRON + more data
      const mixed = Buffer.from([
        72, 101, 108, 108, 111, // "Hello"
        IAC, DO, NEW_ENVIRON,
        87, 111, 114, 108, 100, // "World"
      ]);

      const result = handler.processUpstreamData(mixed);

      expect(handler.isNegotiated()).toBe(true);
      expect(result.response).not.toBeNull();
      // passThrough should contain "Hello" and "World"
      expect(result.passThrough.toString("ascii")).toBe("HelloWorld");
      vi.restoreAllMocks();
    });

    it("handles IAC IAC (escaped 255) as pass-through", () => {
      const handler = new TelnetEnvironHandler("1.2.3.4");
      const data = Buffer.from([IAC, IAC]);

      const result = handler.processUpstreamData(data);

      expect(result.response).toBeNull();
      expect(result.passThrough).toEqual(Buffer.from([IAC, IAC]));
    });

    it("passes through non-NEW_ENVIRON subnegotiations", () => {
      const handler = new TelnetEnvironHandler("1.2.3.4");
      // IAC SB NAWS (31) ... IAC SE
      const subNeg = Buffer.from([IAC, SB, 31, 0, 80, 0, 24, IAC, SE]);

      const result = handler.processUpstreamData(subNeg);

      expect(result.response).toBeNull();
      expect(result.passThrough).toEqual(subNeg);
    });

    it("handles split subnegotiation across packets", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const handler = new TelnetEnvironHandler("10.0.0.1");

      // First negotiate
      handler.processUpstreamData(Buffer.from([IAC, DO, NEW_ENVIRON]));

      // Split SEND subnegotiation
      const varName = Buffer.from("IPADDRESS", "ascii");
      const fullSend = Buffer.from([
        IAC, SB, NEW_ENVIRON, SEND, VAR,
        ...varName,
        IAC, SE,
      ]);

      // Split in the middle of the variable name
      const part1 = fullSend.subarray(0, 8);
      const part2 = fullSend.subarray(8);

      const result1 = handler.processUpstreamData(part1);
      expect(result1.response).toBeNull();

      const result2 = handler.processUpstreamData(part2);
      expect(result2.response).not.toBeNull();
      expect(result2.response!.toString("ascii")).toContain("10.0.0.1");
      vi.restoreAllMocks();
    });
  });

  describe("buildIpInfoMessage", () => {
    it("builds an INFO message with the current IP", () => {
      const handler = new TelnetEnvironHandler("192.168.1.1");
      const msg = handler.buildIpInfoMessage();
      const bytes = [...msg];

      expect(bytes[0]).toBe(IAC);
      expect(bytes[1]).toBe(SB);
      expect(bytes[2]).toBe(NEW_ENVIRON);
      expect(bytes[3]).toBe(INFO);
      expect(msg.toString("ascii")).toContain("IPADDRESS");
      expect(msg.toString("ascii")).toContain("192.168.1.1");
    });

    it("reflects updated IP after setClientIp", () => {
      const handler = new TelnetEnvironHandler("1.1.1.1");
      handler.setClientIp("2.2.2.2");
      const msg = handler.buildIpInfoMessage();
      expect(msg.toString("ascii")).toContain("2.2.2.2");
      expect(msg.toString("ascii")).not.toContain("1.1.1.1");
    });
  });
});

// ── getClientInfo ───────────────────────────────────────────────────

describe("getClientInfo", () => {
  function mockReq(overrides: {
    remoteAddress?: string;
    remotePort?: number;
    headers?: Record<string, string | string[]>;
  } = {}): IncomingMessage {
    return {
      headers: overrides.headers || {},
      socket: {
        remoteAddress: overrides.remoteAddress || "10.0.0.1",
        remotePort: overrides.remotePort || 54321,
      },
    } as unknown as IncomingMessage;
  }

  it("uses socket remoteAddress when no X-Forwarded-For", () => {
    const req = mockReq({ remoteAddress: "192.168.1.5", remotePort: 12345 });
    const info = getClientInfo(req);
    expect(info.ip).toBe("192.168.1.5");
    expect(info.port).toBe(12345);
  });

  it("uses X-Forwarded-For header when present", () => {
    const req = mockReq({
      headers: { "x-forwarded-for": "203.0.113.50" },
    });
    const info = getClientInfo(req);
    expect(info.ip).toBe("203.0.113.50");
  });

  it("takes first IP from comma-separated X-Forwarded-For", () => {
    const req = mockReq({
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
    });
    const info = getClientInfo(req);
    expect(info.ip).toBe("203.0.113.50");
  });

  it("handles array X-Forwarded-For (multiple headers)", () => {
    const req = mockReq({
      headers: { "x-forwarded-for": ["203.0.113.50, 70.41.3.18", "150.172.238.178"] as unknown as string },
    });
    const info = getClientInfo(req);
    expect(info.ip).toBe("203.0.113.50");
  });

  it("strips ::ffff: prefix from IPv6-mapped IPv4", () => {
    const req = mockReq({ remoteAddress: "::ffff:192.168.1.1" });
    const info = getClientInfo(req);
    expect(info.ip).toBe("192.168.1.1");
  });

  it("strips ::ffff: prefix from X-Forwarded-For too", () => {
    const req = mockReq({
      headers: { "x-forwarded-for": "::ffff:10.0.0.5" },
    });
    const info = getClientInfo(req);
    expect(info.ip).toBe("10.0.0.5");
  });

  it("preserves real IPv6 addresses", () => {
    const req = mockReq({ remoteAddress: "2001:db8::1" });
    const info = getClientInfo(req);
    expect(info.ip).toBe("2001:db8::1");
  });

  it("falls back to 127.0.0.1 when no remoteAddress", () => {
    const req = {
      headers: {},
      socket: { remotePort: 1234 },
    } as unknown as IncomingMessage;
    const info = getClientInfo(req);
    expect(info.ip).toBe("127.0.0.1");
  });

  it("uses X-Forwarded-Port when present", () => {
    const req = mockReq({
      headers: { "x-forwarded-port": "8080" },
      remotePort: 54321,
    });
    const info = getClientInfo(req);
    expect(info.port).toBe(8080);
  });

  it("falls back to 0 when no remotePort", () => {
    const req = {
      headers: {},
      socket: { remoteAddress: "1.2.3.4" },
    } as unknown as IncomingMessage;
    const info = getClientInfo(req);
    expect(info.port).toBe(0);
  });
});

// ── parseUpstreamUrl ────────────────────────────────────────────────

describe("parseUpstreamUrl", () => {
  it("parses tls:// as TLS", () => {
    const result = parseUpstreamUrl("tls://example.com:7443");
    expect(result).toEqual({ host: "example.com", port: 7443, useTls: true });
  });

  it("parses wss:// as TLS", () => {
    const result = parseUpstreamUrl("wss://example.com:443");
    expect(result).toEqual({ host: "example.com", port: 443, useTls: true });
  });

  it("parses ssl:// as TLS", () => {
    const result = parseUpstreamUrl("ssl://example.com:993");
    expect(result).toEqual({ host: "example.com", port: 993, useTls: true });
  });

  it("parses tcp:// as plain", () => {
    const result = parseUpstreamUrl("tcp://example.com:7777");
    expect(result).toEqual({ host: "example.com", port: 7777, useTls: false });
  });

  it("parses ws:// as plain", () => {
    const result = parseUpstreamUrl("ws://example.com:8080");
    expect(result).toEqual({ host: "example.com", port: 8080, useTls: false });
  });

  it("parses telnet:// as plain", () => {
    const result = parseUpstreamUrl("telnet://example.com:23");
    expect(result).toEqual({ host: "example.com", port: 23, useTls: false });
  });

  it("defaults to TLS for bare host:port", () => {
    const result = parseUpstreamUrl("example.com:7443");
    expect(result).toEqual({ host: "example.com", port: 7443, useTls: true });
  });

  it("uses default port 7443 for TLS when no port specified", () => {
    const result = parseUpstreamUrl("tls://example.com");
    expect(result.host).toBe("example.com");
    expect(result.port).toBe(7443);
    expect(result.useTls).toBe(true);
  });

  it("uses default port 7777 for plain when no port specified", () => {
    const result = parseUpstreamUrl("tcp://example.com");
    expect(result.host).toBe("example.com");
    expect(result.port).toBe(7777);
    expect(result.useTls).toBe(false);
  });
});
