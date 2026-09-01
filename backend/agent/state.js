const { Annotation } = require('@langchain/langgraph');

/**
 * AgentStateAnnotation defines the state schema for the DRISHTI LangGraph agent.
 * Maintains context across OBSERVE -> REASON -> VALIDATE graph cycles.
 */
const AgentStateAnnotation = Annotation.Root({
  // User's original task / objective
  objective: Annotation({
    reducer: (current, next) => next ?? current ?? '',
    default: () => ''
  }),

  // Current page metadata & raw sanitized DOM payload received from extension
  url: Annotation({
    reducer: (current, next) => next ?? current ?? '',
    default: () => ''
  }),
  title: Annotation({
    reducer: (current, next) => next ?? current ?? '',
    default: () => ''
  }),
  elementCount: Annotation({
    reducer: (current, next) => next ?? current ?? 0,
    default: () => 0
  }),
  rawDom: Annotation({
    reducer: (current, next) => next ?? current ?? null,
    default: () => null
  }),

  // Tree-compressed DOM to minimize token consumption
  compressedDom: Annotation({
    reducer: (current, next) => next ?? current ?? null,
    default: () => null
  }),

  // OCR visual text extracted locally from offscreen document (if available)
  visualContext: Annotation({
    reducer: (current, next) => next ?? current ?? '',
    default: () => ''
  }),

  // Action history recording previous actions and their execution results
  actionHistory: Annotation({
    reducer: (current, next) => (next ? next : (current ?? [])),
    default: () => []
  }),

  // Current autonomous loop step (1-indexed, capped at 10)
  loopCount: Annotation({
    reducer: (current, next) => next ?? current ?? 1,
    default: () => 1
  }),

  // Raw action proposals emitted by the LLM reasoning node
  plannedActions: Annotation({
    reducer: (current, next) => next ?? current ?? [],
    default: () => []
  }),

  // Deterministically validated actions ready for Chrome extension execution
  validatedActions: Annotation({
    reducer: (current, next) => next ?? current ?? [],
    default: () => []
  }),

  // High-level rationale explaining the chosen actions
  summaryReason: Annotation({
    reducer: (current, next) => next ?? current ?? '',
    default: () => ''
  }),

  // Completion flag (true when DONE, REPLY, or max loops reached)
  isDone: Annotation({
    reducer: (current, next) => next ?? current ?? false,
    default: () => false
  }),

  // Error description if any stage fails
  error: Annotation({
    reducer: (current, next) => next ?? current ?? null,
    default: () => null
  }),

  // Structured trace logs produced during graph execution
  logs: Annotation({
    reducer: (current, next) => (Array.isArray(next) ? [...(current || []), ...next] : (current || [])),
    default: () => []
  })
});

module.exports = {
  AgentStateAnnotation
};
