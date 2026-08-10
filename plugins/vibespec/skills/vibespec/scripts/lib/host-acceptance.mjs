import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export const HOST_ACCEPTANCE_CONTRACT = "host-acceptance-v1";

export const HOST_FAMILIES = Object.freeze({
  "claude-code": "claude",
  cowork: "claude",
  "codex-cli": "codex",
  "codex-desktop": "codex"
});

const topLevelKeys = ["kind", "contractVersion", "pluginVersion", "pluginDigest", "host", "hostFamily", "accepted", "checkedAt", "artifacts", "title", "schemaVersion"];
const artifactKeys = ["file", "sha256"];
const digestPattern = /^[a-f0-9]{64}$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  const unknown = actual.filter(key => !wanted.includes(key));
  const missing = wanted.filter(key => !actual.includes(key));
  if (unknown.length) throw new Error(`${label} has unknown field(s): ${unknown.join(", ")}`);
  if (missing.length) throw new Error(`${label} is missing field(s): ${missing.join(", ")}`);
}

function portableFileName(value, label) {
  if (typeof value !== "string" || !value || basename(value) !== value || /[\\/]/.test(value)) {
    throw new Error(`${label} must be a portable artifact basename`);
  }
}

function artifact(value, label) {
  exactKeys(value, artifactKeys, label);
  portableFileName(value.file, `${label}.file`);
  if (!digestPattern.test(value.sha256)) throw new Error(`${label}.sha256 must be a lowercase SHA-256 digest`);
}

function containsAbsolutePath(value) {
  if (typeof value === "string") return /^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value) || /^\/(?:Users|home|tmp|var)\//.test(value);
  if (Array.isArray(value)) return value.some(containsAbsolutePath);
  if (value && typeof value === "object") return Object.values(value).some(containsAbsolutePath);
  return false;
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function hostFamily(host) {
  const family = HOST_FAMILIES[host];
  if (!family) throw new Error(`unsupported host ${JSON.stringify(host)}`);
  return family;
}

export function validateHostEvidence(evidence, expectedVersion = null) {
  exactKeys(evidence, topLevelKeys, "host acceptance evidence");
  if (containsAbsolutePath(evidence)) throw new Error("host acceptance evidence must not contain an absolute local path");
  if (evidence.kind !== "vibespec-host-acceptance") throw new Error("host acceptance evidence.kind is invalid");
  if (evidence.contractVersion !== HOST_ACCEPTANCE_CONTRACT) throw new Error(`unsupported acceptance contract ${JSON.stringify(evidence.contractVersion)}`);
  if (!versionPattern.test(evidence.pluginVersion)) throw new Error("host acceptance evidence.pluginVersion is invalid");
  if (!digestPattern.test(evidence.pluginDigest)) throw new Error("host acceptance evidence.pluginDigest must be a lowercase SHA-256 digest");
  if (expectedVersion && evidence.pluginVersion !== expectedVersion) {
    throw new Error(`host acceptance evidence.pluginVersion ${evidence.pluginVersion} does not match release ${expectedVersion}`);
  }
  const family = hostFamily(evidence.host);
  if (evidence.hostFamily !== family) throw new Error(`hostFamily must be ${family} for ${evidence.host}`);
  if (evidence.accepted !== true) throw new Error("host acceptance evidence must record accepted: true");
  if (typeof evidence.checkedAt !== "string" || Number.isNaN(Date.parse(evidence.checkedAt)) || new Date(evidence.checkedAt).toISOString() !== evidence.checkedAt) {
    throw new Error("host acceptance evidence.checkedAt must be an ISO timestamp");
  }
  if (typeof evidence.title !== "string" || !evidence.title.trim()) throw new Error("host acceptance evidence.title is required");
  if (typeof evidence.schemaVersion !== "string" || !evidence.schemaVersion) throw new Error("host acceptance evidence.schemaVersion is required");
  exactKeys(evidence.artifacts, ["sot", "html"], "host acceptance evidence.artifacts");
  artifact(evidence.artifacts.sot, "host acceptance evidence.artifacts.sot");
  artifact(evidence.artifacts.html, "host acceptance evidence.artifacts.html");
  return evidence;
}
