import { describe, it, expect } from "vitest";
import {
  isPathTraversal,
  isSensitivePath,
  validatePath,
  SENSITIVE_PATHS,
} from "../src/utils/pathValidation.js";

describe("Path Validation Utility", () => {
  const projectRoot = "/home/developer/project";

  describe("isPathTraversal", () => {
    it("should allow safe, in-project paths", () => {
      expect(isPathTraversal("src/index.ts", projectRoot)).toBe(false);
      expect(isPathTraversal("./src/utils/logger.ts", projectRoot)).toBe(false);
      expect(isPathTraversal("package.json", projectRoot)).toBe(false);
    });

    it("should flag paths attempting to escape via parent directories", () => {
      expect(isPathTraversal("../index.ts", projectRoot)).toBe(true);
      expect(isPathTraversal("../../etc/passwd", projectRoot)).toBe(true);
      expect(isPathTraversal("src/../../etc/passwd", projectRoot)).toBe(true);
    });

    it("should flag absolute paths outside the project root", () => {
      expect(isPathTraversal("/etc/passwd", projectRoot)).toBe(true);
      expect(isPathTraversal("/var/log/syslog", projectRoot)).toBe(true);
    });
  });

  describe("isSensitivePath", () => {
    it("should allow regular files", () => {
      expect(isSensitivePath("src/index.ts")).toBe(false);
      expect(isSensitivePath("README.md")).toBe(false);
      expect(isSensitivePath("tsconfig.json")).toBe(false);
    });

    it("should flag sensitive files and folders by name", () => {
      for (const path of SENSITIVE_PATHS) {
        expect(isSensitivePath(path)).toBe(true);
      }
      expect(isSensitivePath("src/config.json")).toBe(true);
      expect(isSensitivePath("/var/secrets.json")).toBe(true);
    });
  });

  describe("validatePath", () => {
    it("should return valid status for clean paths", () => {
      const result = validatePath("src/utils/logger.ts", projectRoot);
      expect(result.isViolation).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it("should identify path traversal violations", () => {
      const result = validatePath("../outside.js", projectRoot);
      expect(result.isViolation).toBe(true);
      expect(result.reason).toContain("Path traversal detected");
    });

    it("should identify sensitive file access violations", () => {
      const result = validatePath("src/.ssh/id_rsa", projectRoot);
      expect(result.isViolation).toBe(true);
      expect(result.reason).toContain("Sensitive path access");
    });
  });
});
