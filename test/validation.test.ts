import { describe, it, expect } from "vitest";
import { validateHost, validateOrigin, validateRequest } from "../src/guard/validation.js";
import { IncomingMessage } from "node:http";

describe("Dev Server Guard - Header Validation", () => {
  describe("validateHost", () => {
    it("should accept localhost", () => {
      expect(validateHost("localhost")).toBe(true);
      expect(validateHost("localhost:3000")).toBe(true);
      expect(validateHost("localhost:8080")).toBe(true);
    });

    it("should accept 127.0.0.1", () => {
      expect(validateHost("127.0.0.1")).toBe(true);
      expect(validateHost("127.0.0.1:3000")).toBe(true);
      expect(validateHost("127.0.0.1:49152")).toBe(true);
    });

    it("should reject external hostnames", () => {
      expect(validateHost("example.com")).toBe(false);
      expect(validateHost("attacker.com")).toBe(false);
      expect(validateHost("192.168.1.100")).toBe(false);
      expect(validateHost("10.0.0.5")).toBe(false);
    });

    it("should reject missing Host header", () => {
      expect(validateHost(undefined)).toBe(false);
    });
  });

  describe("validateOrigin", () => {
    it("should accept localhost origins", () => {
      expect(validateOrigin("http://localhost:3000", undefined)).toBe(true);
      expect(validateOrigin("https://localhost", undefined)).toBe(true);
      expect(validateOrigin("http://127.0.0.1:8080", undefined)).toBe(true);
    });

    it("should accept when neither Origin nor Referer is present", () => {
      expect(validateOrigin(undefined, undefined)).toBe(true);
    });

    it("should reject external origins", () => {
      expect(validateOrigin("http://attacker.com", undefined)).toBe(false);
      expect(validateOrigin("https://evil.example", undefined)).toBe(false);
      expect(validateOrigin(undefined, "http://malicious.site")).toBe(false);
    });

    it("should validate both Origin and Referer when present", () => {
      expect(
        validateOrigin("http://localhost:3000", "http://localhost:3000/page")
      ).toBe(true);

      expect(
        validateOrigin("http://localhost:3000", "http://evil.com/")
      ).toBe(false);
    });
  });

  describe("validateRequest", () => {
    it("should accept valid local requests", () => {
      const mockReq = {
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
      } as IncomingMessage;

      expect(validateRequest(mockReq)).toBe(true);
    });

    it("should reject requests with invalid Host", () => {
      const mockReq = {
        headers: {
          host: "attacker.com",
          origin: "http://localhost:3000",
        },
      } as IncomingMessage;

      expect(validateRequest(mockReq)).toBe(false);
    });

    it("should reject requests with invalid Origin", () => {
      const mockReq = {
        headers: {
          host: "localhost:3000",
          origin: "http://attacker.com",
        },
      } as IncomingMessage;

      expect(validateRequest(mockReq)).toBe(false);
    });

    it("should reject when both Host and Origin are invalid", () => {
      const mockReq = {
        headers: {
          host: "evil.com",
          origin: "http://malicious.site",
        },
      } as IncomingMessage;

      expect(validateRequest(mockReq)).toBe(false);
    });
  });
});
