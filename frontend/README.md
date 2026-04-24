# CUNY Academic Advisor — Chrome Extension

An AI-powered academic advisor that reads your DegreeWorks audit and helps you plan your path to graduation.

---

## Features

- **Auto-scrapes DegreeWorks** — reads your completed credits, in-progress courses, GPA, and requirement blocks automatically
- **AI-powered chat** — ask anything: "What do I still need to graduate?", "What should I take next semester?", "Am I on track?"
- **Quick prompts** — one-click common questions
- **Progress bar** — visual overview of your graduation progress
- **Data inspector** — see exactly what was scraped from your audit
- **Private** — your API key and data stay in your browser

---

## Setup

### 1. Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select this folder (`cuny-advisor-extension/`)

### 2. Add your Anthropic API key

1. Click the extension icon in Chrome's toolbar
2. In the popup, enter your Anthropic API key (`sk-ant-api03-...`)
3. Get a key at [console.anthropic.com/account/keys](https://console.anthropic.com/account/keys)
4. Click **Save API Key**

### 3. Use the advisor

1. Log in to your CUNY portal and navigate to DegreeWorks
2. Wait for DegreeWorks to fully load
3. Click the blue **Advisor** button in the bottom-right corner
4. The AI will greet you and confirm it read your audit
5. Ask away!

---

## File Structure

```
cuny-advisor-extension/
├── manifest.json        # Extension config (Manifest V3)
├── background.js        # Service worker — handles Claude API calls
├── content.js           # Injected into DegreeWorks — scraper + chat UI
├── panel.css            # Styles for the injected chat panel
├── popup.html           # Extension settings popup
├── popup.js             # Settings popup logic
├── icons/               # Extension icons (add your own PNG files)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Improving the Scraper

DegreeWorks HTML varies slightly between CUNY campuses and DW versions. If the advisor says it couldn't read your data:

1. Open DevTools on your DegreeWorks page (`F12`)
2. Inspect the elements containing your GPA, credits, and requirements
3. Note the class names / IDs used
4. Update the selectors in `content.js` in the `scraper` object

The scraper tries many selector patterns and also falls back to full-text regex scanning, so it should work in most cases.

---

## Supported DegreeWorks URLs

The extension activates on:
- `https://degreeworks.cuny.edu/*`
- `https://*.degreeworks.cuny.edu/*`

To add other URLs (e.g., a specific college's portal), update `manifest.json`:

```json
"content_scripts": [{
  "matches": [
    "https://degreeworks.cuny.edu/*",
    "https://your-college-specific-url/*"
  ],
  ...
}]
```

---

## Privacy & Security

- Your Anthropic API key is stored in Chrome's `sync` storage (encrypted)
- Your DegreeWorks data is never sent to any server except Anthropic's API
- No analytics or tracking

---

## Future Improvements

- [ ] Rate my professor integration
- [ ] Course catalog search
- [ ] Multi-semester planning grid
- [ ] Prerequisite chain visualizer
- [ ] Export plan as PDF
- [ ] Support for multiple saved plans
