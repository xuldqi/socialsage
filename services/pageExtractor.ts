
import { CapturedContext, DomNodeSummary, ExtractOptions, PageMetadata, PageState } from '../types';

/**
 * INDUSTRIAL GRADE PAGE EXTRACTOR
 * 
 * This file contains the ACTUAL logic that would run in a Chrome Extension content script.
 * It traverses the REAL DOM, filters noise, and builds a semantic tree for the AI.
 */

// 1. Helpers for Visibility and Interactivity

const isElementVisible = (el: HTMLElement): boolean => {
    if (!el) return false;
    // Check basic properties
    if (el.style.display === 'none' || el.style.visibility === 'hidden' || el.style.opacity === '0') {
        return false;
    }
    // Check bounding box (if it has no size, it's not visible to user)
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        return false;
    }
    return true;
};

const isInteractive = (el: HTMLElement): boolean => {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');

    if (['button', 'a', 'input', 'textarea', 'select', 'details'].includes(tag)) return true;
    if (role && ['button', 'link', 'checkbox', 'menuitem', 'tab'].includes(role)) return true;
    if (el.getAttribute('contenteditable') === 'true') return true;

    // Check for event listeners is hard in pure JS without hacking prototypes, 
    // but we can check for cursor style as a strong hint.
    const style = window.getComputedStyle(el);
    if (style.cursor === 'pointer') return true;

    return false;
};

// 2. DOM Traversal and Compression

const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'PATH', 'LINK', 'META']);
const IGNORED_CLASSES = ['ads', 'advertisement', 'popup-overlay', 'hidden'];

const traverseDom = (root: HTMLElement | Element, options: ExtractOptions): DomNodeSummary[] => {
    const treeWalker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT,
        {
            acceptNode: (node) => {
                const el = node as HTMLElement;
                if (IGNORED_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
                if (!isElementVisible(el)) return NodeFilter.FILTER_SKIP; // Skip hidden but check children? No, usually skip branch.
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    // Recursive builder to reconstruct tree from Walker (Walker is flat-ish, we need hierarchy)
    // Actually, simple recursion on the root's children is often cleaner for "Snapshotting" 
    // provided we manually apply the filters.

    return buildTreeRecursive(root as HTMLElement, 0, options.maxDepth || 6);
};

const buildTreeRecursive = (el: HTMLElement, depth: number, maxDepth: number): DomNodeSummary[] => {
    if (depth > maxDepth) return [];

    const summaries: DomNodeSummary[] = [];
    const children = Array.from(el.children) as HTMLElement[];

    for (const child of children) {
        // Filter Noise
        if (IGNORED_TAGS.has(child.tagName)) continue;
        // Check Visibility
        const rect = child.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || child.style.display === 'none') continue;

        // Build Node
        const summary: DomNodeSummary = {
            nodeId: child.id || `gen_${Math.random().toString(36).substr(2, 5)}`,
            tag: child.tagName.toLowerCase(),
            classes: Array.from(child.classList),
            attributes: {},
            isInteractive: isInteractive(child),
            rect: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top),
                left: Math.round(rect.left)
            }
        };

        // Attributes of interest
        if (child.getAttribute('role')) summary.attributes!['role'] = child.getAttribute('role')!;
        if (child.getAttribute('aria-label')) summary.attributes!['aria-label'] = child.getAttribute('aria-label')!;
        if (child.getAttribute('placeholder')) summary.attributes!['placeholder'] = child.getAttribute('placeholder')!;
        if (child.tagName === 'A' && child.getAttribute('href')) summary.attributes!['href'] = child.getAttribute('href')!;

        // Text Content (Leaf nodes or significant text)
        // If it has direct text nodes that aren't whitespace
        let directText = "";
        child.childNodes.forEach(n => {
            if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) {
                directText += n.textContent.trim() + " ";
            }
        });

        if (directText.length > 0) {
            summary.text = directText.trim().substring(0, 200); // Truncate for token efficiency
        }

        // Recursion
        const childNodes = buildTreeRecursive(child, depth + 1, maxDepth);
        if (childNodes.length > 0) {
            summary.children = childNodes;
        }

        // Optimization: Don't add boring wrapper divs that have no text, no attributes, and only 1 child
        // (Flattening the tree) - Optional, but good for LLM context.
        // For now, let's keep it raw but clean.

        summaries.push(summary);
    }

    return summaries;
};

// 3. Metadata Extraction

const extractMetadata = (): PageMetadata => {
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');

    return {
        url: window.location.href, // In Simulator, this will be the iframe/app URL, but logic holds.
        title: document.title || ogTitle || '',
        description: metaDesc || undefined,
        language: document.documentElement.lang || 'en',
        canonicalUrl: canonical || undefined,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    };
};

// 4. Main Text Extraction (Heuristic based)

const extractMainContent = (root: HTMLElement): string => {
    // Simple density Analysis: find the container with most p tags or text length
    // For the simulation, usually the social posts are in articles.

    // X/Twitter Specific Extraction
    if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
        const activeTweet = root.querySelector('article[data-testid="tweet"]');
        if (activeTweet) {
            return (activeTweet as HTMLElement).innerText;
        }
    }

    const articles = root.querySelectorAll('article, [role="article"], .post-content');
    if (articles.length > 0) {
        return Array.from(articles).map(a => (a as HTMLElement).innerText).join('\n\n---\n\n');
    }

    // Fallback: Get body text but try to exclude nav/footer
    // Since we are scoping to 'root', we assume 'root' IS the content container in the sim.
    return root.innerText.substring(0, 5000);
};

// New Helper: Extract specific post data structure
export const extractSocialPost = (root: HTMLElement = document.body): any => {
    // X/Twitter
    if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
        // Try to find the "focused" tweet (one that contains selection or is in view)
        const selection = window.getSelection();
        let targetNode = selection?.anchorNode?.parentElement;
        // Search up for article
        const tweetArticle = targetNode?.closest('article[data-testid="tweet"]');

        if (tweetArticle) {
            const textElement = tweetArticle.querySelector('div[data-testid="tweetText"]');
            const userElement = tweetArticle.querySelector('div[data-testid="User-Name"]');
            const timeElement = tweetArticle.querySelector('time');
            const avatarImg = tweetArticle.querySelector('div[data-testid="Tweet-User-Avatar"] img');
            const likeElement = tweetArticle.querySelector('div[data-testid="like"]');
            const replyElement = tweetArticle.querySelector('div[data-testid="reply"]');

            // Extract User Info
            const userInfoText = (userElement as HTMLElement)?.innerText || '';
            const [name, handle] = userInfoText.split('\n');

            return {
                id: timeElement?.parentElement?.getAttribute('href') || Date.now().toString(),
                platform: 'X',
                author: handle || name || 'Unknown',
                content: (textElement as HTMLElement)?.innerText || '',
                timestamp: timeElement?.getAttribute('datetime') || new Date().toISOString(),
                likes: likeElement?.getAttribute('aria-label') || '0',
                comments: replyElement?.getAttribute('aria-label') || '0',
                avatarUrl: avatarImg?.getAttribute('src') || ''
            };
        }
    }
    return null;
}

// --- PUBLIC API ---

export const scanPage = (rootElement?: HTMLElement): CapturedContext => {
    const targetRoot = rootElement || document.body;

    const domTree = buildTreeRecursive(targetRoot, 0, 4); // Limit depth to 4 for performance in UI
    const mainContent = extractMainContent(targetRoot);
    const metadata = extractMetadata(); // Note: Reads global document head

    // Calculate page state
    const state: PageState = {
        scrollY: window.scrollY,
        docHeight: document.documentElement.scrollHeight,
        hasPagination: !!document.querySelector('.pagination, [aria-label="Pagination"]'),
        interactiveModalOpen: !!document.querySelector('[role="dialog"], .modal')
    };

    return {
        metadata,
        mainContent,
        domTree,
        state,
        timestamp: Date.now()
    };
};
