// background.ts
// Service Worker for SocialSage AI

declare const chrome: any;

// ============================================
// Settings Keys
// ============================================
const SETTINGS_KEY = 'socialsage_quick_access_settings';

interface QuickAccessSettings {
  enableContextMenu: boolean;
  enableSelectionPopup: boolean;
  enableKeyboardShortcut: boolean;
}

const DEFAULT_SETTINGS: QuickAccessSettings = {
  enableContextMenu: true,
  enableSelectionPopup: true,
  enableKeyboardShortcut: true
};

// ============================================
// Get Settings
// ============================================
async function getSettings(): Promise<QuickAccessSettings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ============================================
// Context Menu
// ============================================
function createContextMenus() {
  // Remove existing menus first
  chrome.contextMenus.removeAll(() => {
    // Parent menu
    chrome.contextMenus.create({
      id: 'socialsage-parent',
      title: 'SocialSage AI',
      contexts: ['selection']
    });

    // Sub-menus
    chrome.contextMenus.create({
      id: 'socialsage-explain',
      parentId: 'socialsage-parent',
      title: '🔍 Explain Selection',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'socialsage-translate',
      parentId: 'socialsage-parent',
      title: '🌐 Translate Selection',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'socialsage-summarize',
      parentId: 'socialsage-parent',
      title: '📝 Summarize Selection',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'socialsage-rewrite',
      parentId: 'socialsage-parent',
      title: '✏️ Rewrite Selection',
      contexts: ['selection']
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info: any, tab: any) => {
  const settings = await getSettings();
  if (!settings.enableContextMenu) return;

  const selectedText = info.selectionText;
  if (!selectedText) return;

  let action = '';
  switch (info.menuItemId) {
    case 'socialsage-explain':
      action = 'explain';
      break;
    case 'socialsage-translate':
      action = 'translate';
      break;
    case 'socialsage-summarize':
      action = 'summarize';
      break;
    case 'socialsage-rewrite':
      action = 'rewrite';
      break;
  }

  if (action) {
    // Open side panel first
    await chrome.sidePanel.open({ tabId: tab.id });

    // Send message to side panel with the action
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'QUICK_ACTION',
        action: action,
        text: selectedText
      }).catch(() => { });
    }, 500);
  }
});

// ============================================
// Side Panel Behavior
// ============================================
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: any) => console.error(error));

// ============================================
// Installation
// ============================================
chrome.runtime.onInstalled.addListener(() => {
  console.log('SocialSage AI installed.');
  createContextMenus();
});

// Also create menus on startup
chrome.runtime.onStartup?.addListener(() => {
  createContextMenus();
});

// ============================================
// Message Handling
// ============================================
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  // Handle settings update - recreate or remove context menus
  if (message.type === 'UPDATE_QUICK_ACCESS_SETTINGS') {
    chrome.storage.local.set({ [SETTINGS_KEY]: message.settings });
    if (message.settings.enableContextMenu) {
      createContextMenus();
    } else {
      chrome.contextMenus.removeAll();
    }
    return false;
  }

  // Handle selection popup action from content script
  if (message.type === 'SELECTION_POPUP_ACTION') {
    getSettings().then(settings => {
      if (!settings.enableSelectionPopup) return;

      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: 'QUICK_ACTION',
            action: message.action,
            text: message.text
          }).catch(() => { });
        }, 500);
      });
    });
    return false;
  }

  // Forward messages from content script to side panel
  if (message.type === 'CAPTURED_CONTEXT' ||
    message.type === 'SELECTION_CHANGE' ||
    message.type === 'FOCUS_CHANGE' ||
    message.type === 'DOM_MUTATION' ||
    message.type === 'NAVIGATION' ||
    message.type === 'REPLY_SELECTOR') {
    chrome.runtime.sendMessage(message).catch(() => { });
  }

  return false;
});