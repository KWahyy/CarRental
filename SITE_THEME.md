# KD's Exotics Public Site Theme

The homepage is the visual source of truth for KD's Exotics customer-facing pages.
The campaign landing page and admin CRM remain intentionally independent.

## Theme Contract

- Add `site-theme` to the page `<body>`.
- Use black cinematic surfaces, off-white text, and gold only for emphasis and primary actions.
- Use Helvetica Neue or the system sans stack for display and body text.
- Keep headlines direct, uppercase, and compact. Keep supporting copy short.
- Alternate dark editorial sections with selective off-white sections when a page needs rhythm.
- Use square or 2px corners for public-site controls and content frames.
- Use real vehicle photography as the main visual signal.
- Keep tap targets at least 44px and collapse split layouts to one column below 900px.

## Page Starter

```html
<body class="site-theme">
  <main>
    <section class="site-section">
      <div class="site-shell site-editorial-grid">
        <div>
          <p class="site-eyebrow">Private automotive concierge</p>
          <h1 class="site-display">The key to bigger moments.</h1>
          <p class="site-lead">One short supporting sentence goes here.</p>
          <div class="site-actions">
            <a class="site-button site-button--primary" href="/#quote">Request a quote</a>
            <a class="site-button" href="/fleet">View fleet</a>
          </div>
        </div>
        <figure class="site-media">
          <img src="/assets/example.jpg" alt="Describe the actual vehicle" />
        </figure>
      </div>
    </section>
  </main>
</body>
```

Shared tokens and components live at the end of `src/styles.css` under
`KD's Exotics public-site theme`.
