export const escapeText = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>';
export const arrow = '<span class="op-arrow" aria-hidden="true">→</span>';
export const cash = value => Number(value).toLocaleString("en-US", {style:"currency",currency:"USD",minimumFractionDigits:0,maximumFractionDigits:2});
export const searchKey = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
export function stateLabel(label, tone="quiet") {
  return `<span class="op-state op-state-${tone}">${escapeText(label)}</span>`;
}
export function photo(src, className="", eager=false, fallback="") {
  return src ? `<img class="${className}" src="${escapeText(src)}" alt="" ${fallback && fallback!==src ? `data-operation-fallback="${escapeText(fallback)}"` : ""} loading="${eager ? "eager" : "lazy"}" decoding="async">` : `<span class="op-no-photo ${className}">Photo unavailable</span>`;
}

export function vehiclePhotoSource(car) {
  const src = car?.image_url || car?.image || car?.photos?.[0]?.url || "";
  const ownedHuracan = car?.id === "674e378c-c689-4f6f-b170-7ce4a6995a43" || car?.slug === "2022-lamborghini-huracan";
  // The live listing originally used a generated cover. Its photographed replacement is bundled locally.
  if (ownedHuracan && (!src || src.includes("01-1784106393633-ChatGPT-Image-Jul-15-2026-01-59-45-AM.png"))) {
    return "/assets/owned-fleet/huracan-evo/cover.jpg";
  }
  return src;
}

export function handleMissingPhotos(container) {
  container?.addEventListener("error", event=>{
    const img=event.target;
    if(img.tagName!=="IMG")return;
    if(img.dataset.operationFallback){
      const url=img.dataset.operationFallback;
      delete img.dataset.operationFallback;
      img.src=url;
      return;
    }
    const replacement=document.createElement("span");
    replacement.className=["op-no-photo",img.className].filter(Boolean).join(" ");
    replacement.textContent="Photo unavailable";
    img.replaceWith(replacement);
  },true);
}
