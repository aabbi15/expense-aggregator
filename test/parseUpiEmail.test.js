const test = require("node:test");
const assert = require("node:assert/strict");
const { parseUpiEmail, toSheetRow } = require("../src/parseUpiEmail");
const samples = require("./sample-emails.json");

function sample(id) {
  return samples.find((email) => email.id === id);
}

test("parses HDFC Swiggy debit like the public UPI Spend Tracker emails", () => {
  const row = parseUpiEmail(sample("hdfc-debit-swiggy"));
  assert.equal(row.valid, true);
  assert.equal(row.amount, 249);
  assert.equal(row.type, "Debit");
  assert.equal(row.app, "HDFC");
  assert.match(row.merchant, /Swiggy/i);
  assert.equal(row.vpa, "swiggy@yesbank");
  assert.equal(row.upiRef, "412345678901");
  assert.equal(row.date, "05-10-2026");
  assert.equal(row.category, "Food");
});

test("parses HDFC credit from a friend VPA", () => {
  const row = parseUpiEmail(sample("hdfc-credit-friend"));
  assert.equal(row.amount, 86);
  assert.equal(row.type, "Credit");
  assert.match(row.merchant, /Varun/i);
  assert.equal(row.category, "Money in");
});

test("parses PhonePe IRCTC receipt", () => {
  const row = parseUpiEmail(sample("phonepe-irctc"));
  assert.equal(row.amount, 185);
  assert.equal(row.app, "PhonePe");
  assert.match(row.merchant, /Irctc Uts/i);
  assert.equal(row.category, "Travel");
  assert.equal(row.upiRef, "T2503052030208914193200");
});

test("parses Google Pay Uber payment", () => {
  const row = parseUpiEmail(sample("gpay-uber"));
  assert.equal(row.amount, 350);
  assert.equal(row.app, "Google Pay");
  assert.match(row.merchant, /Uber/i);
  assert.equal(row.category, "Travel");
});

test("parses Paytm Netflix payment", () => {
  const row = parseUpiEmail(sample("paytm-netflix"));
  assert.equal(row.amount, 199);
  assert.equal(row.app, "Paytm");
  assert.equal(row.category, "Entertainment");
});

test("parses SBI, ICICI and Axis bank UPI alerts", () => {
  const sbi = parseUpiEmail(sample("sbi-debit"));
  const icici = parseUpiEmail(sample("icici-zomato"));
  const axis = parseUpiEmail(sample("axis-amazon"));

  assert.equal(sbi.amount, 99);
  assert.equal(sbi.app, "SBI");
  assert.equal(sbi.category, "Bills");

  assert.equal(icici.amount, 420);
  assert.equal(icici.app, "ICICI");
  assert.equal(icici.category, "Food");

  assert.equal(axis.amount, 1299);
  assert.equal(axis.app, "Axis");
  assert.equal(axis.category, "Shopping");
  assert.match(axis.funNote, /left the chat/i);
});

test("ignores promo mail that is not a UPI transaction", () => {
  const row = parseUpiEmail(sample("promo-ignored"));
  assert.equal(row.valid, false);
  assert.equal(row.amount, null);
});

test("maps parsed fields onto Google Sheet columns", () => {
  const row = toSheetRow(parseUpiEmail(sample("hdfc-debit-swiggy")));
  assert.deepEqual(Object.keys(row), [
    "Date",
    "Month",
    "Amount",
    "Type",
    "Merchant",
    "Category",
    "App",
    "VPA",
    "UPI_Ref",
    "Fun_Note",
    "Subject",
    "MessageId",
  ]);
  assert.equal(row.Amount, 249);
  assert.match(row.Category, /Food/);
});
