export function vehicleShellMarkup(seoMarkup = "") {
  return `
    <div class="vehicle-private-page">
      <a class="vehicle-private-back" href="/fleet.html"><span aria-hidden="true">←</span> Return to collection</a>

      <section class="vehicle-private-hero" aria-labelledby="vehicle-private-title">
        <div class="vehicle-private-title-card">
          <span class="vehicle-private-year" data-vehicle-year>Private collection</span>
          <p data-vehicle-category>Exotic vehicle</p>
          <h1 id="vehicle-private-title" data-vehicle-title>Vehicle</h1>
          <div class="vehicle-mobile-rate"><span>From</span><strong data-vehicle-price></strong></div>
          <div class="vehicle-mobile-specs" aria-label="Quick vehicle details">
            <div>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20v-6a3 3 0 0 1 3-3h2V5a2 2 0 0 1 4 0v9h1a3 3 0 0 1 3 3v3"/><path d="M5 20h16M12 14H8a3 3 0 0 0-3 3v3"/></svg>
              <strong data-vehicle-seats></strong><span>Seats</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15a8 8 0 0 1 16 0"/><path d="m12 15 4-5"/><path d="M5 19h14"/></svg>
              <strong data-vehicle-mileage-short></strong><span>Mi/day</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
              <strong>Concierge</strong><span>Delivery</span>
            </div>
          </div>
          <a href="#vehicle-request">Request this vehicle <span aria-hidden="true">↘</span></a>
        </div>
        <div class="vehicle-gallery-stage">
          <div class="vehicle-gallery-frame">
          <button class="vehicle-gallery-nav vehicle-gallery-nav-prev" type="button" aria-label="Previous photo" data-gallery-prev><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
          <picture data-gallery-picture><source data-gallery-source /><img data-gallery-main alt="" width="1600" height="1100" fetchpriority="high" decoding="async" /></picture>
          <button class="vehicle-gallery-nav vehicle-gallery-nav-next" type="button" aria-label="Next photo" data-gallery-next><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>
          </div>
          <div class="vehicle-mobile-gallery-status">
            <span data-gallery-count aria-live="polite">1 / 1</span>
            <div data-gallery-dots aria-label="Choose vehicle photo"></div>
          <button class="vehicle-gallery-open" type="button" data-gallery-open aria-haspopup="dialog">View all photos <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </section>

      <div class="vehicle-gallery-strip">
        <div class="vehicle-gallery-caption"><span>Explore every angle</span><span data-gallery-total></span></div>
        <div class="vehicle-private-photo-grid" data-gallery-thumbs aria-label="Vehicle photos"></div>
      </div>
      <dialog class="vehicle-photo-dialog" data-gallery-dialog aria-labelledby="vehicle-photo-dialog-title">
        <div class="vehicle-photo-dialog-header"><h2 id="vehicle-photo-dialog-title">Vehicle gallery</h2><button type="button" data-gallery-close aria-label="Close gallery" autofocus>Close <span aria-hidden="true">×</span></button></div>
        <div class="vehicle-photo-dialog-stage"><button type="button" data-lightbox-prev aria-label="Previous full-screen photo">←</button><img data-lightbox-image alt="" width="1600" height="1100" decoding="async" draggable="false" /><button type="button" data-lightbox-next aria-label="Next full-screen photo">→</button></div>
        <div class="vehicle-photo-dialog-footer"><p data-lightbox-count role="status"></p><a data-lightbox-original target="_blank" rel="noopener">Open original ↗</a></div>
      </dialog>

      <section class="vehicle-rental-information" data-vehicle-rental-info aria-label="Rental information and terms"></section>

      <section class="vehicle-private-information" aria-label="Vehicle information and request">
        <article class="vehicle-private-overview">
          <p class="eyebrow">Overview</p>
          <h2>About this vehicle.</h2>
          <p class="vehicle-private-summary" data-vehicle-summary></p>
          <div class="vehicle-private-specs" aria-label="Vehicle specifications">
            <div><span>Engine</span><strong data-vehicle-engine></strong></div>
            <div><span>Seats</span><strong data-vehicle-seats></strong></div>
            <div><span>0–60 mph</span><strong data-vehicle-acceleration></strong></div>
            <div><span>Body</span><strong data-vehicle-type></strong></div>
            <div><span>Exterior</span><strong data-vehicle-color></strong></div>
            <div><span>Included mileage</span><strong data-vehicle-mileage></strong></div>
          </div>

          <div class="vehicle-private-inclusions">
            <p class="eyebrow">The vehicle</p>
            <ul data-vehicle-details></ul>
          </div>

        </article>

        <aside id="vehicle-request" class="vehicle-private-request">
          <p class="eyebrow">Private vehicle request</p>
          <h2>Check your dates.</h2>
          <p>Availability changes frequently. Your concierge will verify the exact vehicle and requested dates before confirming anything.</p>
          <div class="vehicle-request-rate"><span>Starting from</span><strong data-vehicle-price></strong></div>
          <form data-vehicle-request-form>
            <input name="vehicle" type="hidden" />
            <div class="vehicle-request-step vehicle-request-step-dates" data-request-step="dates">
              <div class="vehicle-request-dates">
                <label><span>Pickup date &amp; time</span><div class="vehicle-date-control"><input name="date" type="datetime-local" required /><span class="vehicle-date-placeholder" aria-hidden="true">Select date</span></div></label>
                <label><span>Return date &amp; time <small>Optional</small></span><div class="vehicle-date-control"><input name="returnDate" type="datetime-local" /><span class="vehicle-date-placeholder" aria-hidden="true">Select date</span></div></label>
              </div>
              <label><span>Delivery city or ZIP</span><input name="deliveryLocation" type="text" autocomplete="postal-code" placeholder="City or ZIP code" required /></label>
              <button class="vehicle-request-continue" type="button" data-request-continue>Check availability <span aria-hidden="true">→</span></button>
              <p class="vehicle-request-assurance">No payment today. We personally verify availability.</p>
            </div>
            <div class="vehicle-request-step vehicle-request-step-details" data-request-step="details">
              <div class="vehicle-request-step-heading"><strong>Your details.</strong><button type="button" data-request-back>Edit dates</button></div>
              <label><span>Full name</span><input name="name" type="text" autocomplete="name" required /></label>
              <label><span>Phone</span><input name="phone" type="tel" autocomplete="tel" required /></label>
              <label><span>Email <small>Optional</small></span><input name="email" type="email" autocomplete="email" /></label>
              <label class="vehicle-request-alternatives"><input name="alternatives" type="checkbox" checked /><span>Show me similar options if this car is unavailable.</span></label>
              <label class="quote-honeypot" aria-hidden="true"><span>Company</span><input name="company" type="text" tabindex="-1" autocomplete="off" /></label>
              <button type="submit">Request This Vehicle <span aria-hidden="true">↗</span></button>
              <p data-vehicle-request-status role="status">Your request goes directly to the Prestige Luxor concierge.</p>
            </div>
          </form>
          <a class="vehicle-request-call" href="tel:+19496200024">Prefer to speak privately? Call (949) 620-0024</a>
        </aside>
      </section>

      ${seoMarkup}

      <section class="related-section vehicle-product-related" aria-label="Related vehicles">
        <div class="section-heading compact-heading"><p class="eyebrow">Continue exploring</p><h2>Similar vehicles</h2><p>Three considered alternatives from the active collection.</p></div>
        <div class="related-grid" data-related></div>
      </section>

      <nav class="vehicle-mobile-actions" aria-label="Vehicle actions">
        <a href="tel:+19496200024">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.78a2 2 0 0 1-.45 2.11L8.08 9.88a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.88.33 1.82.56 2.78.69A2 2 0 0 1 22 16.92Z"/></svg>
          Call concierge
        </a>
        <a href="#vehicle-request">Request this car <span aria-hidden="true">→</span></a>
      </nav>
    </div>`;
}
