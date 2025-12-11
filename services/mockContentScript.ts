import { CapturedContext, DomNodeSummary, PageMetadata, PageState, SocialPost, Platform } from '../types';

/**
 * MOCK CONTENT SCRIPT
 * 
 * This service simulates the "Frontend Acquisition Layer" described by the user.
 * Since we don't have a real DOM for Twitter/Reddit (it's a canvas/mock), 
 * we generate a synthetic "DOM Tree" and metadata that *looks* like what a 
 * real scraping agent (like Perplexity or Arc) would extract.
 */

const generateMockDomTree = (platform: string, posts: SocialPost[]): DomNodeSummary[] => {
    // Generate a compressed DOM tree based on the platform style
    const nodes: DomNodeSummary[] = [];

    if (platform.includes('twitter') || platform.includes('x.com')) {
        // Mock Twitter Feed DOM
        const feedNode: DomNodeSummary = {
            nodeId: 'n_feed_01',
            tag: 'div',
            classes: ['css-175oi2r', 'r-kemksi', 'r-1kqtdi0'],
            role: 'feed',
            attributes: { 'aria-label': 'Timeline: Your Home Timeline' },
            children: posts.filter(p => p.platform === Platform.X).map((post, idx) => ({
                nodeId: `n_post_${post.id}`,
                tag: 'article',
                classes: ['css-1dbjc4n', 'r-1loqt21', 'r-18u3705'],
                attributes: { 'data-testid': 'tweet', 'tabindex': '0' },
                children: [
                    { nodeId: `n_auth_${post.id}`, tag: 'div', classes: ['User-Name'], text: post.author },
                    { nodeId: `n_txt_${post.id}`, tag: 'div', classes: ['css-901oao', 'r-18jsvk2'], text: post.content },
                    { 
                        nodeId: `n_actions_${post.id}`, 
                        tag: 'div', 
                        classes: ['css-1dbjc4n', 'r-18u3705'], 
                        children: [
                            { nodeId: `n_reply_${post.id}`, tag: 'button', classes: ['r-1777fci'], attributes: {'aria-label': 'Reply', 'data-testid': 'reply'} },
                            { nodeId: `n_like_${post.id}`, tag: 'button', classes: ['r-1777fci'], attributes: {'aria-label': 'Like', 'data-testid': 'like'} }
                        ]
                    }
                ]
            }))
        };
        nodes.push(feedNode);
    } else if (platform.includes('mail')) {
        nodes.push({
            nodeId: 'n_mail_container',
            tag: 'div',
            classes: ['aU', 'm7'],
            children: [
                { nodeId: 'n_subject', tag: 'h2', classes: ['hP'], text: 'Project Collaboration Request' },
                { nodeId: 'n_body', tag: 'div', classes: ['a3s', 'aiL'], text: 'Hi there, I\'d love to discuss a partnership...' },
                { nodeId: 'n_reply_box', tag: 'div', classes: ['Am', 'Al'], role: 'textbox', isInteractive: true, attributes: {'aria-label': 'Reply body'} }
            ]
        });
    } else {
        // Generic Fallback DOM
        nodes.push({
            nodeId: 'n_main',
            tag: 'main',
            role: 'main',
            children: [
                { nodeId: 'n_h1', tag: 'h1', text: 'Page Title' },
                { nodeId: 'n_content', tag: 'article', text: 'Main content area with extracted text.' }
            ]
        });
    }

    return nodes;
};

export const capturePageContext = (url: string, posts: SocialPost[], lang: string = 'en'): CapturedContext => {
    // 1. Basic Page Info
    let metadata: PageMetadata = {
        url: url,
        title: 'SocialSage AI Browser',
        description: 'Simulated social media environment.',
        language: lang,
        viewport: { width: 1280, height: 800 }
    };

    // 2. Visible Text (Cleaned)
    let mainContent = "";

    // 3. Page State
    let state: PageState = {
        scrollY: 150,
        docHeight: 2500,
        hasPagination: false,
        interactiveModalOpen: false
    };

    // --- Customization based on URL ---
    if (url.includes('twitter')) {
        metadata.title = "Home / X";
        metadata.description = "Breaking news, entertainment, sports and politics.";
        metadata.canonicalUrl = "https://twitter.com/home";
        mainContent = posts.filter(p => p.platform === Platform.X).map(p => `${p.author}: ${p.content}`).join('\n\n');
        state.hasPagination = true; // Infinite scroll
    } else if (url.includes('reddit')) {
        metadata.title = "Reddit - Dive into anything";
        mainContent = posts.filter(p => p.platform === Platform.Reddit).map(p => `u/${p.author}: ${p.content}`).join('\n\n');
    } else if (url.includes('mail')) {
        metadata.title = "Inbox (1) - Gmail";
        mainContent = "Subject: Project Collaboration. Body: Hi there...";
    }

    // 4. Generate compressed DOM Tree
    const domTree = generateMockDomTree(url, posts);

    return {
        metadata,
        mainContent,
        domTree,
        state,
        userFocus: {
            selectionText: "", // Filled by browser event listeners in real time
            hoverNodeId: undefined
        },
        timestamp: Date.now()
    };
};