const LOCAL_PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const PRODUCTION_QUOTE_ENDPOINT = "https://www.kdsexotics.com/api/quote";
const QUOTE_REQUEST_TIMEOUT_MS = 20000;

export function quoteEndpoint() {
  return LOCAL_PREVIEW_HOSTS.has(window.location.hostname)
    ? PRODUCTION_QUOTE_ENDPOINT
    : "/api/quote";
}

export async function submitQuoteRequest(payload) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), QUOTE_REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(quoteEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The request took too long. Please try again or call us directly.");
    }
    throw new Error("We could not reach our booking desk. Please try again or call us directly.");
  } finally {
    window.clearTimeout(timeoutId);
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    throw new Error(result.message || "Your request could not be sent.");
  }

  if (typeof window.gtag_report_conversion === "function") {
    window.gtag_report_conversion();
  }

  return result;
}
