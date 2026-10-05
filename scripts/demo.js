const { parseUpiEmail, toSheetRow } = require("../src/parseUpiEmail");
const samples = require("../test/sample-emails.json");

const rows = samples
  .map(parseUpiEmail)
  .filter((row) => row.valid)
  .map(toSheetRow);

console.log("Expense Aggregator sample rows\n");
console.table(
  rows.map((row) => ({
    Date: row.Date,
    Amount: row.Amount,
    Type: row.Type,
    Merchant: row.Merchant,
    Category: row.Category,
    App: row.App,
  })),
);
