# Intuitive Lexicon (Static Dictionary Site)

A simple, fast, and elegant static dictionary site generator. Designed for writing intuitive explanations, poetic/sensory imagination, morphological patterns, and original neologisms across multiple languages.

## 🗂️ Repository Structure

Every entry is simply a Markdown file (`.md`):

```text
├── en/                          # English
│   ├── word.md                  # Standard word: @en(word)
│   ├── entropy.md
│   ├── patterns/                # Language patterns / affixes
│   │   ├── _ism.md              # Suffix: @en.pattern(-ism)
│   │   └── un-.md               # Prefix: @en.pattern(un-)
│   └── coinage/                 # Invented words / neologisms
│       └── sonderland.md        # Coinage: @en.coinage(sonderland)
├── tr/                          # Türkçe
│   ├── gönül.md                 # @tr(gönül)
│   ├── vuslat.md
│   ├── patterns/
│   │   └── -lik.md              # @tr.pattern(-lik)
│   └── coinage/
│       └── özdüşüm.md           # @tr.coinage(özdüşüm)
├── de/                          # Deutsch
│   ├── schadenfreude.md         # @de(schadenfreude)
│   ├── patterns/
│   │   └── ver-.md              # @de.pattern(ver-)
│   └── coinage/
│       └── Halbmund.md          # @de.coinage(Halbmund)
├── assets/                      # Styles & client-side scripts
├── build.js                     # Static site builder & search indexer
├── serve.js                     # Local dev server with live auto-rebuild
├── netlify.toml                 # Netlify deployment configuration
└── package.json
```

To add another language (e.g. French `fr`, Spanish `es`, Latin `la`), just create a top-level directory with the language code.

---

## ✍️ How to Write Entries

### 1. Multiple Analyses / Entries (`---`)
Within any `.md` file, separate multiple analyses or angles using `---` on its own line:

```markdown
# entropy

A measure of dispersed possibilities. Imagine a clean desk: there is only one way for every object to be in its exact place, but quintillions of ways for things to be scattered.

---

### Emotional Entropy
The natural unraveling of mental clarity when no energy is put into maintaining inner stillness. Related to @en(word).
```

Each section is rendered into an elegant analysis card with dedicated headings.

---

### 2. Cross-Referencing Syntax
Reference any other word, pattern, or coined word using the `@` notation:

- **Standard word**: `@en(word)` or `@tr(gönül)`
- **Pattern / Affix**: `@en.pattern(-ism)` or `@de.pattern(ver-)`
- **Coinage**: `@de.coinage(Halbmund)` or `@tr.coinage(özdüşüm)`
- **Custom label (optional)**: `@en.pattern(-ism|the suffix -ism)`

#### Features of Cross-References:
- **Intelligent resolution**: Handles filename variations seamlessly (e.g. `@en.pattern(-ism)` automatically maps to `en/patterns/_ism.md` or `-ism.md`).
- **Interactive badges**: Formatted as styled pills indicating the target language and category.
- **Hover previews**: Hovering over any reference shows a floating preview card with the definition snippet.
- **Automatic Backlinks ("Referenced In")**: When entry A references entry B, entry B automatically lists entry A as a backlink!
- **Missing references (stubs)**: If you reference a word you haven't written yet, it displays as a dashed placeholder with a `?` badge so you know what to document next.

---

## 🔍 Fully Static Search

- Search is **100% static** and runs completely client-side in the browser.
- Press **`/`** or **`Cmd+K` / `Ctrl+K`** from anywhere on the site to open the instant search modal.
- Supports instant filtering by language (`All`, `EN`, `TR`, `DE`) and type (`Words`, `Patterns`, `Coinages`).
- Dedicated `/search/` page for deep browsing.
- Pre-indexes titles, terms, morphological types, summaries, and full text into `search-index.json`.

---

## ✍️ In-Browser Editor (Local Development)

When running locally with `npm run dev`, you can browse and edit your entries directly in the browser:

- **Edit any entry**: Press **`e`** (or click the **`edit`** button in the header) while viewing any entry.
- **Save changes**: Press **`Cmd+S`** or **`Ctrl+S`** (or click **`Save`**). The dev server writes the changes directly to your Markdown file on disk and rebuilds the site instantly.
- **Create a new entry**: Press **`n`** (or click **`+ new`**) to create a new word, pattern, or coinage.
- **Zero build bloat**: When built for production (`npm run build` / Netlify), the editor scripts and buttons are **completely omitted**. The production site is 100% pure static HTML.

---

## 🚀 Running Locally

```bash
# 1. Install dependency
npm install

# 2. Start local development server with in-browser editor
npm run dev
# -> Opens http://localhost:3000

# 3. Build pure static site for deployment (Netlify)
npm run build
```

---

## 🌐 Deploying to Netlify

The repository includes `netlify.toml` preconfigured for zero-setup deployment:

1. Push your repository to GitHub / GitLab.
2. In Netlify, click **Add new site** &rarr; **Import an existing project**.
3. Netlify will auto-detect:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Every time you push new markdown files to Git, Netlify builds and deploys your static site in seconds!
