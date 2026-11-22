const displayDate = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles",
});

function dateLabel(value) {
  if (!value) return "";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00Z" : value);
  return Number.isNaN(date.getTime()) ? String(value) : displayDate.format(date);
}

export function openInquiryReview(record, trigger, { canWrite = false } = {}) {
  if (!record?.id || document.querySelector("[data-inquiry-review][open]")) return;
  const dialog = document.createElement("dialog");
  dialog.className = "dispatch-handoff";
  dialog.dataset.inquiryReview = "";
  dialog.setAttribute("aria-labelledby", "inquiry-review-title");
  dialog.innerHTML = `<header><small>Reservation inquiry</small><button type="button" data-dispatch-close aria-label="Close inquiry">×</button></header>
    <h2 id="inquiry-review-title"></h2><dl></dl><p data-inquiry-feedback role="status"></p>`;
  dialog.querySelector("h2").textContent = record.name || "Customer inquiry";
  const list = dialog.querySelector("dl");
  const fields = [
    ["Submitted", dateLabel(record.created_at)], ["Vehicle", record.vehicle],
    ["Pickup date", dateLabel(record.rental_date)], ["Phone", record.phone],
    ["Email", record.email], ["Requested services", Array.isArray(record.addons) ? record.addons.join(", ") : ""],
  ];
  for (const [label, value] of fields) {
    if (!value) continue;
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    description.style.overflowWrap = "anywhere";
    row.append(term, description);
    list.append(row);
  }
  // Newer public forms append a separate attribution block after the trip details.
  const notes = String(record.message || "").replace(/(?:^|\n\n)(?:Acquisition source|Acquisition channel|Submission page|Latest touch): [\s\S]*$/, "").trim();
  if (notes) {
    const title = document.createElement("h3");
    title.textContent = "Request details";
    const copy = document.createElement("p");
    copy.textContent = notes;
    copy.style.whiteSpace = "pre-line";
    copy.style.overflowWrap = "anywhere";
    list.after(title, copy);
  }
  if (canWrite) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Prepare quote";
    button.dataset.prepareInquiry = "";
    dialog.append(button);
    button.addEventListener("click", async () => {
      const feedback = dialog.querySelector("[data-inquiry-feedback]");
      button.disabled = true;
      feedback.textContent = "Opening quote builder…";
      try {
        const { prepareQuoteForInquiry } = await import("./quotes.js?v=dispatch-1");
        await prepareQuoteForInquiry(record, () => dialog.open);
        if (dialog.open) dialog.close("builder");
      } catch (error) {
        feedback.textContent = error.message || "Could not open the quote builder.";
        button.disabled = false;
      }
    });
  }
  dialog.querySelector("[data-dispatch-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (dialog.returnValue !== "builder" && trigger?.isConnected) trigger.focus({ preventScroll: true });
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
}
