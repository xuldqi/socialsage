// background.ts
// This runs as a Service Worker in the background.

declare const chrome: any;

// Ensure the side panel opens when the user clicks the extension icon.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: any) => console.error(error));

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('SocialSage AI installed.');
});

// Forward messages from content script to side panel
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  // Forward CAPTURED_CONTEXT and other messages to all extension pages (including side panel)
  if (message.type === 'CAPTURED_CONTEXT' || 
      message.type === 'SELECTION_CHANGE' || 
      message.type === 'FOCUS_CHANGE' ||
      message.type === 'DOM_MUTATION' ||
      message.type === 'NAVIGATION' ||
      message.type === 'REPLY_SELECTOR') {
    // Broadcast to all extension views
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors if no listeners
    });
  }
  return false;
});