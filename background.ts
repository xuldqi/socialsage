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
// Context Menu Translations
// ============================================
const MENU_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    explain: '🔍 Explain Selection',
    translate: '🌐 Translate Selection',
    summarize: '📝 Summarize Selection',
    rewrite: '✏️ Rewrite Selection'
  },
  zh: {
    explain: '🔍 解释选中内容',
    translate: '🌐 翻译选中内容',
    summarize: '📝 总结选中内容',
    rewrite: '✏️ 改写选中内容'
  },
  ja: {
    explain: '🔍 選択を説明',
    translate: '🌐 選択を翻訳',
    summarize: '📝 選択を要約',
    rewrite: '✏️ 選択を書き換え'
  }
};

// ============================================
// Context Menu
// ============================================
async function createContextMenus() {
  // Get user language setting
  let lang = 'en';
  try {
    const result = await chrome.storage.local.get('socialsage_settings');
    if (result.socialsage_settings?.language) {
      lang = result.socialsage_settings.language;
    }
  } catch { }

  const t = MENU_TRANSLATIONS[lang] || MENU_TRANSLATIONS.en;

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
      title: t.explain,
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'socialsage-translate',
      parentId: 'socialsage-parent',
      title: t.translate,
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'socialsage-summarize',
      parentId: 'socialsage-parent',
      title: t.summarize,
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'socialsage-rewrite',
      parentId: 'socialsage-parent',
      title: t.rewrite,
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
// Keyboard Shortcut Command
// ============================================
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-sidebar') {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        await chrome.sidePanel.open({ tabId: tabs[0].id });
      }
    } catch (err) {
      console.error('[Background] Error opening sidebar via shortcut:', err);
    }
  }
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
    console.log('[Background] Received SELECTION_POPUP_ACTION:', message);

    getSettings().then(async (settings) => {
      if (!settings.enableSelectionPopup) {
        console.log('[Background] Selection popup disabled');
        return;
      }

      try {
        // Get the current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = sender?.tab?.id || tabs[0]?.id;

        if (!tabId) {
          console.error('[Background] No tab id found');
          return;
        }

        console.log('[Background] Opening side panel for tab:', tabId);
        await chrome.sidePanel.open({ tabId });

        // Send message to side panel after it opens
        setTimeout(() => {
          console.log('[Background] Sending QUICK_ACTION to side panel');
          chrome.runtime.sendMessage({
            type: 'QUICK_ACTION',
            action: message.action,
            text: message.text
          }).catch((err: any) => {
            console.log('[Background] Side panel message error (expected):', err);
          });
        }, 800);
      } catch (err) {
        console.error('[Background] Error handling selection popup:', err);
      }
    });
    return true; // Keep channel open for async
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