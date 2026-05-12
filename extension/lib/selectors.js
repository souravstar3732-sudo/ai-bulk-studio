// lib/selectors.js — default selector heuristics per platform.
// These are best-guess CSS selectors; the calibration page lets users click-to-bind exact ones.
// Each value can be a single selector, an array of fallbacks, or {role, contains}.

export const DEFAULT_SELECTORS = {
  grok: {
    promptInput: [
      'textarea[placeholder*="Imagine" i]',
      'textarea[placeholder*="Describe" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea[aria-label*="prompt" i]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea'
    ],
    bulkPromptArea: [
      'textarea[placeholder*="bulk" i]',
      'div[data-bulk]',
      'textarea[placeholder*="multiple" i]'
    ],
    imageUpload: [
      'input[type="file"][accept*="image" i]',
      'input[type="file"]'
    ],
    startImageUpload: [
      'input[type="file"][data-role="start" i]',
      'input[type="file"][accept*="image" i]'
    ],
    endImageUpload: [
      'input[type="file"][data-role="end" i]',
      'input[type="file"][accept*="image" i]'
    ],
    generateButton: [
      'button[aria-label*="Generate" i]',
      'button[aria-label*="Create" i]',
      'button:has(svg[aria-label*="send" i])',
      'button[type="submit"]'
    ],
    runAllButton: [
      'button:contains("Run All")',
      'button[aria-label*="run all" i]'
    ],
    resultCardArea: [
      '[data-testid*="result" i]',
      'main',
      '[class*="grid" i]'
    ],
    videoArea: [
      'video',
      'video[src]'
    ],
    imageArea: [
      'img[src*="grok" i]',
      'main img'
    ],
    downloadButton: [
      'a[download]',
      'button[aria-label*="download" i]',
      'a[href*=".mp4"]',
      'a[href*=".png"]'
    ],
    retryButton: [
      'button[aria-label*="retry" i]',
      'button:contains("Retry")'
    ],
    errorArea: [
      '[role="alert"]',
      '[class*="error" i]'
    ]
  },
  flow: {
    promptInput: [
      'textarea[aria-label*="prompt" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea',
      'div[contenteditable="true"][role="textbox"]'
    ],
    bulkPromptArea: [
      'textarea[aria-label*="bulk" i]',
      'textarea[placeholder*="batch" i]'
    ],
    imageUpload: [
      'input[type="file"][accept*="image" i]',
      'input[type="file"]'
    ],
    startImageUpload: [
      'input[type="file"][data-role*="start" i]',
      'input[type="file"][accept*="image" i]'
    ],
    endImageUpload: [
      'input[type="file"][data-role*="end" i]',
      'input[type="file"][accept*="image" i]'
    ],
    generateButton: [
      'button[aria-label*="Generate" i]',
      'button[aria-label*="Create" i]',
      'button:contains("Generate")',
      'button[type="submit"]'
    ],
    runAllButton: [
      'button:contains("Run All")',
      'button:contains("Generate All")'
    ],
    resultCardArea: [
      '[data-testid*="result" i]',
      '[role="list"]',
      'main'
    ],
    videoArea: [
      'video',
      'video[src]'
    ],
    imageArea: [
      'main img',
      'img[src*="storage.googleapis" i]'
    ],
    downloadButton: [
      'a[download]',
      'button[aria-label*="download" i]',
      'a[href*=".mp4"]'
    ],
    retryButton: [
      'button[aria-label*="retry" i]',
      'button:contains("Retry")'
    ],
    errorArea: [
      '[role="alert"]',
      '[class*="error" i]'
    ]
  }
};
