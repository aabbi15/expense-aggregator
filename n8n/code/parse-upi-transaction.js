/**
 * n8n Code node — Run Once for All Items
 * Paste this entire file into the "Parse UPI Transaction" node.
 */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CATEGORY_RULES = [
  { category: "Food", emoji: "🍜", keywords: ["swiggy", "zomato", "dominos", "mcdonald", "kfc", "starbucks", "chai", "maggi", "blinkit", "zepto", "instamart", "eatsure", "box8"] },
  { category: "Travel", emoji: "🛺", keywords: ["uber", "ola", "rapido", "irctc", "indigo", "airindia", "makemytrip", "redbus", "metro"] },
  { category: "Shopping", emoji: "🛍️", keywords: ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa"] },
  { category: "Bills", emoji: "💡", keywords: ["jio", "airtel", "vi ", "vodafone", "electricity", "bescom", "adani", "gas", "bharat bill"] },
  { category: "Entertainment", emoji: "🎬", keywords: ["netflix", "hotstar", "disney", "spotify", "bookmyshow", "pvr", "youtube"] },
];

const FUN_NOTES = {
  Food: "Another food order. Future you says thanks... maybe.",
  Travel: "Wheels up. Wallet down.",
  Shopping: "Retail therapy logged. The parcel is already on its way.",
  Bills: "Adulting detected. Bill paid, wifi lives another month.",
  Entertainment: "Entertainment unlocked. Don't skip the intro.",
  Transfer: "Paisa moved. Friendship / rent / split-bill diplomacy continues.",
  "Money in": "Money came in. Treat yourself, but maybe not immediately.",
  Other: "A wild UPI appeared. Logged before it vanished.",
};

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function normalize(text) {
  return String(text || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\r\n/g, "\n").trim();
}

function toNumber(raw) {
  if (raw == null) return null;
  const value = Number(String(raw).replace(/[, ]/g, ""));
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
  const match = text.match(/(?:INR|Rs\.?|₹)\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/i);
  return match ? toNumber(match[1]) : null;
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
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return "";
}

function titleCase(value) {
  return String(value).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function extractMerchant(text, vpa) {
  const patterns = [
    /paid to\s+([A-Z0-9][A-Za-z0-9 .&'-]{1,60}?)(?:\s*₹|\s+INR|\s+Rs\.?|\n|$)/i,
    /paid\s+(?:₹|Rs\.?|INR)\s*[0-9,.]+\s+to\s+([A-Z0-9][A-Za-z0-9 .&'-]{1,60}?)(?:\s+via|\s+using|\.|\n|$)/i,
    /to VPA\s+\S+\s+([A-Z][A-Z0-9 .&'-]{1,60}?)(?:\s+on\b|\s*\.|\n|$)/,
    /by VPA\s+\S+\s+([A-Z][A-Z0-9 .&'-]{1,60}?)(?:\s+on\b|\s*\.|\n|$)/,
    /Info:\s*UPI\/([^/\n]+)\/?/i,
    /UPI\/([A-Z0-9][A-Za-z0-9 .&'-]{1,40}?)(?:\/|\s)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return titleCase(match[1].replace(/\s+/g, " ").trim());
  }
  if (vpa) {
    const handle = vpa.split("@")[0].replace(/[._-]+/g, " ").trim();
    if (handle && !/^\d+$/.test(handle)) return titleCase(handle);
  }
  return "Unknown merchant";
}

function formatDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function parseLooseDate(raw) {
  const numeric = raw.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numeric) {
    let [, dd, mm, yyyy] = numeric;
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(date.getTime())) return formatDate(date);
  }
  const named = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (named) {
    let [, dd, mon, yyyy] = named;
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    const date = new Date(`${mon} ${dd}, ${yyyy}`);
    if (!Number.isNaN(date.getTime())) return formatDate(date);
  }
  return null;
}

function extractTxnDate(text, fallbackDate) {
  const patterns = [/\bon\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i, /\bon\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/i, /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = parseLooseDate(match[1]);
      if (parsed) return parsed;
    }
  }
  const fallback = fallbackDate ? new Date(fallbackDate) : new Date();
  return formatDate(Number.isNaN(fallback.getTime()) ? new Date() : fallback);
}

function monthLabel(dateStr) {
  const parts = dateStr.split("-").map(Number);
  return parts[1] && parts[2] ? `${MONTHS[parts[1] - 1]} ${parts[2]}` : "";
}

function categorize(merchant, type) {
  if (type === "Credit") return { category: "Money in", emoji: "💸" };
  const hay = merchant.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => hay.includes(keyword))) return { category: rule.category, emoji: rule.emoji };
  }
  return { category: "Transfer", emoji: "🔁" };
}

function funNote(category, amount, type) {
  const rupees = amount != null ? `₹${amount}` : "some paisa";
  if (type === "Credit") return `${FUN_NOTES["Money in"]} ${rupees} landed.`;
  if (amount != null && amount >= 1000) return `${rupees} left the chat. Big ticket.`;
  return FUN_NOTES[category] || FUN_NOTES.Other;
}

function parseUpiEmail(input) {
  const subject = normalize(input.subject || input.Subject || "");
  const from = normalize(input.from || input.From || "");
  const html = input.html || input.textHtml || "";
  const text = normalize(input.text || input.textPlain || input.snippet || input.body || stripHtml(html));
  const combined = `${subject}\n${from}\n${text}`;
  const amount = extractAmount(combined);
  const type = detectType(combined);
  const vpa = extractVpa(combined);
  const merchant = extractMerchant(combined, vpa);
  const { category, emoji } = categorize(merchant, type);
  const date = extractTxnDate(combined, input.date || input.internalDate);
  const isUpi = /upi|vpa|phonepe|google pay|gpay|paytm|ybl|okaxis|okhdfc|okicici/i.test(combined);

  return {
    date,
    month: monthLabel(date),
    amount,
    type,
    merchant,
    category,
    emoji,
    app: detectSource({ from, subject, body: text }),
    vpa,
    upiRef: extractUpiRef(combined),
    subject,
    from,
    messageId: input.id || input.messageId || "",
    snippet: text.slice(0, 240),
    isUpi,
    funNote: funNote(category, amount, type),
    valid: Boolean(amount) && isUpi,
    Date: date,
    Month: monthLabel(date),
    Amount: amount,
    Type: type,
    Merchant: merchant,
    Category: `${emoji} ${category}`,
    App: detectSource({ from, subject, body: text }),
    VPA: vpa,
    UPI_Ref: extractUpiRef(combined),
    Fun_Note: funNote(category, amount, type),
    Subject: subject,
    MessageId: input.id || input.messageId || "",
  };
}

const output = [];
for (const item of $input.all()) {
  output.push({ json: parseUpiEmail(item.json), pairedItem: item });
}
return output;
