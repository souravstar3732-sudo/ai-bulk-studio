// lib/selectors.js — default selector heuristics per platform.
// These are best-guess CSS selectors; the calibration page lets users click-to-bind exact ones.
// Each value can be a single selector, an array of fallbacks, or {role, contains}.

export const DEFAULT_SELECTORS = {
  _version: "1.0.1",
  grok: {
    promptInput: [
      '[data-testid="imagine-prompt-input"]',
      'textarea[data-testid*="prompt" i]',
      'textarea[placeholder*="Imagine" i]',
      'textarea[placeholder*="imagine" i]',
      'textarea[placeholder*="Describe" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea[aria-label*="prompt" i]',
      'div[contenteditable="true"][role="textbox"]',
      'main textarea',
      'textarea'
    ],
    bulkPromptArea: [
      '[data-testid*="bulk" i] textarea',
      'textarea[placeholder*="bulk" i]',
      'textarea[placeholder*="multiple" i]',
      'div[data-bulk]'
    ],
    imageUpload: [
      'input[type="file"][accept*="image" i]',
      'input[type="file"]'
    ],
    startImageUpload: [
      '[data-testid*="start" i] input[type="file"]',
      'input[type="file"][data-role="start" i]',
      'input[type="file"][accept*="image" i]'
    ],
    endImageUpload: [
      '[data-testid*="end" i] input[type="file"]',
      'input[type="file"][data-role="end" i]'
    ],
    generateButton: [
      '[data-testid="submit-button"]',
      'button[data-testid*="submit" i]',
      'button[data-testid*="generate" i]',
      'button[aria-label*="Generate" i]',
      'button[aria-label*="Submit" i]',
      'button[aria-label*="Create" i]',
      'button[aria-label*="Send" i]',
      'button:contains("Generate")',
      'button:contains("Submit")',
      'button[type="submit"]'
    ],
    runAllButton: [
      'button:contains("Run All")',
      'button:contains("Generate All")',
      'button[aria-label*="run all" i]'
    ],
    resultCardArea: [
      '[data-testid*="result" i]',
      '[data-testid*="gallery" i]',
      '[data-testid*="image-card" i]',
      'main [role="list"]',
      'main [class*="grid" i]',
      'main'
    ],
    videoArea: [
      'video[src]',
      'video'
    ],
    imageArea: [
      '[data-testid*="image" i] img',
      'main img[src*="grok" i]',
      'main img[src*="xai" i]',
      'main img'
    ],
    downloadButton: [
      'a[download]',
      'button[aria-label*="download" i]',
      'button[data-testid*="download" i]',
      'a[href*=".mp4"]',
      'a[href*=".png"]',
      'a[href*=".webp"]'
    ],
    retryButton: [
      'button[aria-label*="retry" i]',
      'button[data-testid*="retry" i]',
      'button:contains("Retry")'
    ],
    errorArea: [
      '[role="alert"]',
      '[class*="error" i]',
      '[data-testid*="error" i]'
    ]
  },
  flow: {
    promptInput: [
      '[data-testid*="prompt" i] textarea',
      'textarea[aria-label*="prompt" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="Describe" i]',
      'div[contenteditable="true"][role="textbox"]',
      'main textarea',
      'textarea'
    ],
    bulkPromptArea: [
      '[data-testid*="bulk" i] textarea',
      'textarea[aria-label*="bulk" i]',
      'textarea[placeholder*="batch" i]'
    ],
    imageUpload: [
      'input[type="file"][accept*="image" i]',
      'input[type="file"]'
    ],
    startImageUpload: [
      '[data-testid*="start" i] input[type="file"]',
      '[data-testid*="frame-1" i] input[type="file"]',
      'input[type="file"][data-role*="start" i]',
      'input[type="file"][accept*="image" i]'
    ],
    endImageUpload: [
      '[data-testid*="end" i] input[type="file"]',
      '[data-testid*="frame-2" i] input[type="file"]',
      'input[type="file"][data-role*="end" i]'
    ],
    generateButton: [
      'button[data-testid*="generate" i]',
      'button[data-testid*="submit" i]',
      'button[aria-label*="Generate" i]',
      'button[aria-label*="Create" i]',
      'button:contains("Generate")',
      'button:contains("Create")',
      'button[type="submit"]'
    ],
    runAllButton: [
      'button:contains("Run All")',
      'button:contains("Generate All")',
      'button:contains("Run Batch")'
    ],
    resultCardArea: [
      '[data-testid*="result" i]',
      '[data-testid*="gallery" i]',
      '[role="list"]',
      'main [class*="grid" i]',
      'main'
    ],
    videoArea: [
      'video[src]',
      'video'
    ],
    imageArea: [
      'main img[src*="storage.googleapis" i]',
      'main img[src*="googleusercontent" i]',
      'main img'
    ],
    downloadButton: [
      'a[download]',
      'button[aria-label*="download" i]',
      'button[data-testid*="download" i]',
      'a[href*=".mp4"]'
    ],
    retryButton: [
      'button[aria-label*="retry" i]',
      'button[data-testid*="retry" i]',
      'button:contains("Retry")'
    ],
    errorArea: [
      '[role="alert"]',
      '[class*="error" i]',
      '[data-testid*="error" i]'
    ]
  }
};
