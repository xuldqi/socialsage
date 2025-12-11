# SocialSage AI - Chrome Web Store Submission Guide

此文档包含了发布 SocialSage AI 到 Chrome 网上应用店所需的所有文案、素材清单以及隐私合规信息。请在提交审核时直接参考或复制以下内容。

---

## 🎨 Phase 2: 商店素材 (Store Assets)

### 1. 文字信息 (Copywriting)

在 "Store Listing" 页面填写。

**Extension Name (插件名称):**
`SocialSage AI - Smart Social Assistant`

**Summary / Short Description (短描述 - 限 132 字符):**
`Boost your social growth with AI auto-replies, style cloning, and data extraction for X, LinkedIn, Reddit & more. Bring your own Key.`

**Description (长描述 - 支持 Markdown):**
*(请直接复制以下内容)*

```markdown
🚀 **Transform your social media workflow with SocialSage AI.**

SocialSage is an intelligent browser copilot designed to help you engage faster, write better, and manage your social presence without the burnout. Whether you are on X (Twitter), LinkedIn, Reddit, or checking emails, SocialSage is ready to assist.

**✨ Key Features:**

🤖 **Context-Aware Auto-Reply**
Instantly generate relevant, engaging replies based on the post content. Choose from intents like "Agree", "Disagree", "Question", or "Humorous".

🎭 **Persona & Style Cloning**
Don't sound like a robot. Create custom Personas (e.g., "Professional Expert", "Witty Casual") or clone the writing style of your favorite influencers with one click.

⚡ **Smart Automation (Human-in-the-loop)**
Set up "Auto-Rules" to automatically draft replies for posts matching specific keywords. Use the "Review Queue" to approve drafts before they are sent.

🔍 **Data Extraction & Summarization**
- Extract structured data from any webpage into JSON.
- Summarize long YouTube/Bilibili videos or articles in seconds.
- Translate and explain selected text instantly.

🔒 **Privacy First**
- **Bring Your Own Key:** Supports Google Gemini and OpenAI/DeepSeek compatible keys.
- **Local Storage:** Your rules, personas, and history are stored locally in your browser.
- **No Data Selling:** We do not collect or sell your browsing history.

**Supported Platforms:**
X (Twitter), LinkedIn, Reddit, Weibo, Xiaohongshu, Gmail, Facebook, and more.

**Note:** This extension requires a Google Gemini API Key (Free tier available) or an OpenAI-compatible key to function.
```

**Category (分类):**
`Productivity` (生产力工具) -> `Workflow & Planning` (工作流) 或 `Social & Communication`

---

### 2. 图片素材 (Graphic Assets)

请按照以下尺寸准备图片 (PNG 或 JPEG，建议 PNG)。

| 类型 | 尺寸 (像素) | 说明 |
| :--- | :--- | :--- |
| **Store Icon** | 128 x 128 | 应用图标 (必须透明背景 PNG) |
| **Small Tile** | 440 x 280 | 在商店搜索列表中显示的小图。建议放Logo+应用名。 |
| **Marquee Tile** | 1400 x 560 | **最重要**。详情页顶部大图。展示侧边栏正在工作的样子。 |
| **Screenshots** | 1280 x 800 | 至少 3 张截图。 |

**截图建议：**
1.  **截图 1 (浏览场景)**：打开 Twitter，展开 SocialSage 侧边栏，展示 "Assist" 页面分析当前帖子的状态。
2.  **截图 2 (回复生成)**：展示 "Draft" 区域生成了一段回复，并且有人设 (Persona) 选择的下拉框。
3.  **截图 3 (设置/规则)**：展示 "Rules" 或 "Settings" 页面，体现高度可配置性。

---

## 🛡️ Phase 3: 隐私与合规 (Privacy & Legal)

在 "Privacy" 选项卡中填写。

### 1. Privacy Policy (隐私政策)

Google 要求提供一个 URL。你可以将下面的文本复制到 Notion、GitHub Gist 或你的个人网站上，然后填入链接。

*(Privacy Policy Text Start)*

```text
**Privacy Policy for SocialSage AI**
Last Updated: [Current Date]

**1. Introduction**
SocialSage AI ("we", "our") is a browser extension designed to assist users with social media interactions. We value your privacy and are committed to protecting your data.

**2. Data Collection & Usage**
- **Web Content:** To provide context-aware AI responses, the extension reads the text content (DOM) of the web page you are currently viewing (e.g., a Tweet or LinkedIn post). This data is ephemeral and is sent directly to the AI Provider (Google Gemini or your configured custom provider) for processing. We do not store this data on our own servers.
- **User Settings:** Your preferences, personas, rules, and API keys are stored locally on your device using Chrome's `localStorage` and `chrome.storage` APIs.

**3. Third-Party Services**
This extension interacts with Third-Party AI providers based on your configuration:
- **Google Gemini API:** If selected, data is processed according to Google's Privacy Policy.
- **Custom Providers (OpenAI/DeepSeek):** If configured, data is processed by the respective provider.
Please refer to their respective privacy policies for details on how they handle data.

**4. Data Security**
Your API Keys are stored locally on your device. We strongly recommend using the extension's settings to input your own private API keys for maximum security and control.

**5. Contact**
If you have questions about this policy, please contact us at: [Your Email Address]
```
*(Privacy Policy Text End)*

### 2. Permissions Justification (权限理由)

Google 会询问你为什么需要每一个权限。请直接复制以下英文回答（这是审核员最看重的地方）。

**Q: Why do you need "activeTab"?**
> The extension needs to read the text content of the currently active social media post (e.g. a Tweet or Reddit thread) to generate relevant AI replies.

**Q: Why do you need "storage"?**
> To save user configurations locally, including custom Personas (writing styles), Auto-Reply Rules, and the user's API Key preference.

**Q: Why do you need "scripting"?**
> To inject a content script that safely extracts the main text and metadata from the webpage DOM, which is then passed to the side panel for analysis.

**Q: Why do you need "sidePanel"?**
> The core user interface of the application lives in the Chrome Side Panel, allowing users to multitask alongside their social media feed.

**Q: Why do you need Host Permissions (*://twitter.com, etc.)?**
> The extension provides specialized DOM extraction logic for these specific social platforms to ensure high-quality context for the AI. It needs access to run the extraction script on these domains.

**Q: Do you use remote code?**
> No. All logic is bundled within the extension. However, we connect to remote AI APIs (Google Gemini) to process text.

### 3. Data Usage (单一用途认证)

**Q: What is the single purpose of your extension?**
> An AI-powered assistant that helps users draft replies and manage social media interactions via the sidebar.

**Q: Data usage checklist:**
*   勾选: "Does this extension collect user data?" -> **No** (If you don't have a backend server).
    *   *注意：如果你认为发给 Gemini 算收集，可以选 Yes，然后声明只用于 "Functionality" (功能实现)。但在 Chrome 定义里，如果你没有自己的服务器存数据，通常选 No 也可以，或者选 Yes 但注明是 Local Storage。建议选 Yes -> Storage -> Local -> "To save user preferences".*

---

## ✅ 发布检查清单

1.  [ ] `manifest.json` 版本号是否正确 (v1.0.0)？
2.  [ ] `services/geminiService.ts` 里的 `SYSTEM_API_KEYS` 是否填入了备用 Key？
3.  [ ] `App.tsx` 里的 `DEPLOY_MODE` 是否设为 `'extension'`？
4.  [ ] 是否运行了 `npm run build` 并测试了 `dist` 文件夹？
5.  [ ] 隐私政策链接是否可访问？

祝发布顺利！
