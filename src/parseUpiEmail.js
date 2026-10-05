/**
 * Parse a UPI alert into sheet fields.
 * Patterns cover HDFC, PhonePe, Google Pay, Paytm, SBI, ICICI, and Axis alerts.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CATEGORY_RULES = [
  { category: "Food", keywords: ["swiggy", "zomato", "dominos", "mcdonald", "kfc", "starbucks", "chai", "maggi", "blinkit", "zepto", "instamart", "eatsure", "box8"] },
  { category: "Travel", keywords: ["uber", "ola", "rapido", "irctc", "indigo", "airindia", "makemytrip", "redbus", "metro"] },
  { category: "Shopping", keywords: ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa"] },
  { category: "Bills", keywords: ["jio", "airtel", "vi ", "vodafone", "electricity", "bescom", "adani", "gas", "bharat bill"] },
  { category: "Entertainment", keywords: ["netflix", "hotstar", "disney", "spotify", "bookmyshow", "pvr", "youtube"] },
];

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8377;|&rsquo;|₹/g, "₹");
}

function normalize(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();
}

function toNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[, ]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function detectSource({ from = "", subject = "", body = "" }) {
  const blob = `${from} ${subject} ${body}`.toLowerCase();
  if (/phonepe|@ybl\b/.test(blob)) return "PhonePe";
  if (/google pay|\bgpay\b|noreply@google\.com/.test(blob)) return "Google Pay";
  if (/paytm/.test(blob)) return "Paytm";
  if (/hdfc/.test(blob)) return "HDFC";
  if (/icici/.test(blob)) return "ICICI";
  if (/\bsbi\b|sbi\.co\.in|state bank/.test(blob)) return "SBI";
  if (/axis/.test(blob)) return "Axis";
  if (/kotak/.test(blob)) return "Kotak";
  if (/upi/.test(blob)) return "UPI";
  return "Unknown";
}

function detectType(text) {
  const t = text.toLowerCase();
  if (/credited|received|has received|money received|added to/.test(t)) return "Credit";
  if (/debited|paid to|has been sent|spent|withdrawn/.test(t)) return "Debit";
  return "Debit";
}

function extractAmount(text) {
  const patterns = [
    /(?:INR|Rs\.?|₹)\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/i,
    /(?:INR|Rs\.?|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /(?:amount|paid)\s+(?:of\s+)?(?:INR|Rs\.?|₹)?\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return toNumber(match[1]);
  }
  return null;
}

function extractVpa(text) {
  const matches = [...String(text).matchAll(/\b([a-z0-9._-]{2,64}@([a-z][a-z0-9._-]{1,32}))\b/gi)]
    .map((match) => ({ full: match[1].toLowerCase(), psp: match[2].toLowerCase() }))
    .filter((value) => !value.psp.includes("."));
  return matches[0] ? matches[0].full : "";
}

function extractUpiRef(text) {
  const patterns = [
    /UPI\s*(?:Ref(?:erence)?(?:\s*No\.?)?|Txn(?:n)?(?:\s*ID)?|transaction id)\s*[:#-]?\s*([A-Z0-9]{8,32})/i,
    /Txn\.?\s*ID\s*[:#-]?\s*([A-Z0-9]{8,32})/i,
    /Bank\s*Ref(?:erence)?(?:\s*No\.?)?\s*[:#-]?\s*([A-Z0-9]{8,32})/i,
    /UTR\s*[:#-]?\s*([A-Z0-9]{8,32})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return "";
}

function extractMerchant(text, vpa) {
  const patterns = [
    /paid to\s+([A-Z0-9][A-Za-z0-9 .&'-]{1,60}?)(?:\s*₹|\s+INR|\s+Rs\.?|\n|$)/i,
    /paid\s+(?:₹|Rs\.?|INR)\s*[0-9,.]+\s+to\s+([A-Z0-9][A-Za-z0-9 .&'-]{1,60}?)(?:\s+via|\s+using|\.|\n|$)/i,
    /to VPA\s+\S+\s+([A-Z][A-Z0-9 .&'-]{1,60}?)(?:\s+on\b|\s*\.|\n|$)/,
    /by VPA\s+\S+\s+([A-Z][A-Z0-9 .&'-]{1,60}?)(?:\s+on\b|\s*\.|\n|$)/,
    /Info:\s*UPI\/([^/\n]+)\/?/i,
    /UPI\/([A-Z0-9][A-Za-z0-9 .&'-]{1,40}?)(?:\/|\s)/,
    /towards\s+([A-Z0-9][A-Za-z0-9 .&'-]{1,60}?)(?:\s+on\b|\.|\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = cleanMerchant(match[1]);
      if (name) return name;
    }
  }

  if (vpa) {
    const handle = vpa.split("@")[0].replace(/[._-]+/g, " ").trim();
    if (handle && !/^\d+$/.test(handle)) return titleCase(handle);
  }

  return "Unknown merchant";
}

function cleanMerchant(name) {
  return titleCase(
    String(name)
      .replace(/\s+/g, " ")
      .replace(/[.:-]+$/, "")
      .trim(),
  );
}

function titleCase(value) {
  return String(value)
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function extractTxnDate(text, fallbackDate) {
  const patterns = [
    /\bon\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    /\bon\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/i,
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = parseLooseDate(match[1]);
      if (parsed) return parsed;
    }
  }
  const fallback = fallbackDate ? new Date(fallbackDate) : new Date();
  if (Number.isNaN(fallback.getTime())) return formatDate(new Date());
  return formatDate(fallback);
}

function parseLooseDate(raw) {
  const value = raw.trim();
  const numeric = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numeric) {
    let [, dd, mm, yyyy] = numeric;
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(date.getTime())) return formatDate(date);
  }
  const named = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (named) {
    let [, dd, mon, yyyy] = named;
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    const date = new Date(`${mon} ${dd}, ${yyyy}`);
    if (!Number.isNaN(date.getTime())) return formatDate(date);
  }
  return null;
}

function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function monthLabel(dateStr) {
  const [dd, mm, yyyy] = dateStr.split("-").map(Number);
  if (!mm || !yyyy) return "";
  return `${MONTHS[mm - 1]} ${yyyy}`;
}

function categorize(merchant, type) {
  if (type === "Credit") return "Money in";
  const hay = merchant.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => hay.includes(keyword))) {
      return rule.category;
    }
  }
  return "Transfer";
}

function parseUpiEmail(input = {}) {
  const subject = normalize(input.subject || input.Subject || "");
  const from = normalize(input.from || input.From || "");
  const html = input.html || input.textHtml || input.htmlBody || "";
  const text = normalize(
    input.text || input.textPlain || input.snippet || input.body || stripHtml(html),
  );
  const combined = `${subject}\n${from}\n${text}`;

  const amount = extractAmount(combined);
  const type = detectType(combined);
  const source = detectSource({ from, subject, body: text });
  const vpa = extractVpa(combined);
  const upiRef = extractUpiRef(combined);
  const merchant = extractMerchant(combined, vpa);
  const date = extractTxnDate(combined, input.date || input.internalDate);
  const category = categorize(merchant, type);
  const isUpi = /upi|vpa|phonepe|google pay|gpay|paytm|ybl|okaxis|okhdfc|okicici/i.test(combined);

  return {
    date,
    month: monthLabel(date),
    amount,
    type,
    merchant,
    category,
    app: source,
    vpa,
    upiRef,
    subject,
    from,
    messageId: input.id || input.messageId || "",
    snippet: text.slice(0, 240),
    isUpi,
    valid: Boolean(amount) && isUpi,
  };
}

function toSheetRow(parsed) {
  return {
    Date: parsed.date,
    Month: parsed.month,
    Amount: parsed.amount,
    Type: parsed.type,
    Merchant: parsed.merchant,
    Category: parsed.category,
    App: parsed.app,
    VPA: parsed.vpa,
    UPI_Ref: parsed.upiRef,
    Subject: parsed.subject,
    MessageId: parsed.messageId,
  };
}

module.exports = {
  parseUpiEmail,
  toSheetRow,
  stripHtml,
  detectSource,
  extractAmount,
};
