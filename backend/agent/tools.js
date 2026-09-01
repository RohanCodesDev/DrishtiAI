const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

/**
 * DRISHTI Browser Capability Tools
 * 
 * NOTE: In DRISHTI's architecture, these tools define structured action capabilities
 * for the LangChain/LangGraph agent. They do NOT execute DOM manipulations directly
 * in Node.js; the actual execution occurs in the Chrome extension (content.js / sidebar.js).
 */

const clickElementTool = tool(
  async ({ target_id, reason }) => {
    return {
      action: 'CLICK',
      target_id,
      reason: reason || 'Click element'
    };
  },
  {
    name: 'click_element',
    description: 'Click on a specific interactive element identified by its drishti_id (e.g. element_14).',
    schema: z.object({
      target_id: z.string().describe('The drishti_id of the element to click, e.g. "element_3"'),
      reason: z.string().describe('Brief reason for clicking this element')
    })
  }
);

const typeTextTool = tool(
  async ({ target_id, value, reason }) => {
    return {
      action: 'TYPE',
      target_id,
      value,
      reason: reason || 'Type text into field'
    };
  },
  {
    name: 'type_text',
    description: 'Type text into an input field or textarea identified by its drishti_id.',
    schema: z.object({
      target_id: z.string().describe('The drishti_id of the input/textarea element'),
      value: z.string().describe('The text string to type into the element'),
      reason: z.string().describe('Brief reason for typing this text')
    })
  }
);

const scrollPageTool = tool(
  async ({ target_id, value, reason }) => {
    return {
      action: 'SCROLL',
      target_id: target_id || undefined,
      value: value || 'down',
      reason: reason || 'Scroll page viewport'
    };
  },
  {
    name: 'scroll_page',
    description: 'Scroll the page up or down, or scroll a specific element into view.',
    schema: z.object({
      target_id: z.string().optional().describe('Optional drishti_id of element to scroll into view'),
      value: z.enum(['up', 'down']).optional().describe('Direction to scroll if no target_id is specified'),
      reason: z.string().describe('Brief explanation for scrolling')
    })
  }
);

const waitTool = tool(
  async ({ reason }) => {
    return {
      action: 'WAIT',
      value: '2000ms',
      reason: reason || 'Wait for page state to update'
    };
  },
  {
    name: 'wait',
    description: 'Pause execution for 2 seconds to wait for asynchronous network requests or DOM updates.',
    schema: z.object({
      reason: z.string().describe('Reason for waiting')
    })
  }
);

const navigateTool = tool(
  async ({ value, reason }) => {
    return {
      action: 'NAVIGATE',
      value,
      reason: reason || 'Navigate to URL'
    };
  },
  {
    name: 'navigate',
    description: 'Navigate the active tab to a new URL.',
    schema: z.object({
      value: z.string().url().describe('The full HTTP/HTTPS URL to navigate to'),
      reason: z.string().describe('Reason for navigating')
    })
  }
);

const replyUserTool = tool(
  async ({ value, reason }) => {
    return {
      action: 'REPLY',
      value,
      reason: reason || 'Reply to user objective'
    };
  },
  {
    name: 'reply_user',
    description: 'Send a final conversational message or answer directly to the user in the sidebar UI.',
    schema: z.object({
      value: z.string().describe('The response message to present to the user'),
      reason: z.string().describe('Reasoning for the reply')
    })
  }
);

const finishTaskTool = tool(
  async ({ reason }) => {
    return {
      action: 'DONE',
      reason: reason || 'Task complete'
    };
  },
  {
    name: 'finish_task',
    description: 'Mark the multi-step browser automation workflow as completely finished.',
    schema: z.object({
      reason: z.string().describe('Summary of why the workflow is complete')
    })
  }
);

const keyPressTool = tool(
  async ({ target_id, value, reason }) => {
    return {
      action: 'KEYPRESS',
      target_id: target_id || undefined,
      value: value || 'Enter',
      reason: reason || 'Press key'
    };
  },
  {
    name: 'key_press',
    description: 'Simulate pressing a specific keyboard key (such as Enter, Tab, Escape, ArrowDown) on an input field or active element.',
    schema: z.object({
      target_id: z.string().optional().describe('Optional drishti_id of the element to press key on'),
      value: z.string().describe('The key name to press, e.g. "Enter", "Tab", "Escape"'),
      reason: z.string().describe('Reason for key press')
    })
  }
);

const newTabTool = tool(
  async ({ value, reason }) => {
    return {
      action: 'NEW_TAB',
      value: value || 'https://www.google.com',
      reason: reason || 'Open in new tab'
    };
  },
  {
    name: 'new_tab',
    description: 'Open a brand new browser tab and navigate to a URL or Google search query.',
    schema: z.object({
      value: z.string().describe('The URL or search query to open in the new tab'),
      reason: z.string().describe('Reason for opening new tab')
    })
  }
);

const DRISHTI_TOOLS = [
  clickElementTool,
  typeTextTool,
  keyPressTool,
  scrollPageTool,
  waitTool,
  navigateTool,
  newTabTool,
  replyUserTool,
  finishTaskTool
];

module.exports = {
  clickElementTool,
  typeTextTool,
  keyPressTool,
  scrollPageTool,
  waitTool,
  navigateTool,
  newTabTool,
  replyUserTool,
  finishTaskTool,
  DRISHTI_TOOLS
};
