/**
 * DRISHTI Prompts Proxy
 * Maintained for backward-compatible root-level imports.
 */

const { AGENT_SYSTEM_PROMPT, compressTree, compactInteractiveDom, buildUserPrompt } = require('./agent/prompts');

module.exports = {
  AGENT_SYSTEM_PROMPT,
  compressTree,
  compactInteractiveDom,
  buildUserPrompt
};

