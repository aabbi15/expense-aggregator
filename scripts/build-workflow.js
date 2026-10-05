const fs = require("fs");
const path = require("path");

const parseCode = fs.readFileSync(path.join(__dirname, "../n8n/code/parse-upi-transaction.js"), "utf8");
const sampleCode = fs.readFileSync(path.join(__dirname, "../n8n/code/load-sample-emails.js"), "utf8");

function filterParams(conditions, combinator = "or") {
  return {
    conditions: {
      options: {
        caseSensitive: false,
        leftValue: "",
        typeValidation: "loose",
        version: 2,
      },
      conditions,
      combinator,
    },
  };
}

const workflow = {
  name: "Expense Aggregator",
  nodes: [
    {
      parameters: {
        content: "## Expense Aggregator\nReads UPI alerts from Gmail (HDFC, SBI, ICICI, Axis, PhonePe, GPay, Paytm), parses amount / merchant / VPA, and appends a fun row to Google Sheets.\n\n**Test first:** click `When clicking Test` → Sample UPI Emails.\n**Go live:** connect Gmail + Sheets, then activate.",
        height: 280,
        width: 360,
        color: 4,
      },
      id: "note-intro",
      name: "Sticky Note",
      type: "n8n-nodes-base.stickyNote",
      typeVersion: 1,
      position: [-80, -40],
    },
    {
      parameters: {
        pollTimes: { item: [{ mode: "everyMinute" }] },
        simple: true,
        filters: {
          q: '(UPI OR PhonePe OR "Google Pay" OR GPay OR Paytm OR "transaction alert" OR VPA OR "UPI Ref" OR debited OR credited) -category:promotions newer_than:7d',
        },
        options: {},
      },
      id: "gmail-trigger",
      name: "Gmail Trigger",
      type: "n8n-nodes-base.gmailTrigger",
      typeVersion: 1.2,
      position: [360, 80],
      webhookId: "expense-aggregator-gmail",
      credentials: {
        gmailOAuth2: {
          id: "REPLACE_WITH_GMAIL_CREDENTIAL_ID",
          name: "Gmail account",
        },
      },
    },
    {
      parameters: filterParams(
        [
          {
            id: "subj-upi",
            leftValue: "={{ $json.subject }}",
            rightValue: "UPI",
            operator: { type: "string", operation: "contains" },
          },
          {
            id: "subj-phonepe",
            leftValue: "={{ $json.subject }}",
            rightValue: "PhonePe",
            operator: { type: "string", operation: "contains" },
          },
          {
            id: "subj-gpay",
            leftValue: "={{ $json.subject }}",
            rightValue: "Google Pay",
            operator: { type: "string", operation: "contains" },
          },
          {
            id: "from-bank",
            leftValue: "={{ $json.from }}",
            rightValue: "alerts@",
            operator: { type: "string", operation: "contains" },
          },
          {
            id: "snippet-vpa",
            leftValue: "={{ $json.snippet || $json.text || '' }}",
            rightValue: "VPA",
            operator: { type: "string", operation: "contains" },
          },
        ],
        "or",
      ),
      id: "keep-upi-emails",
      name: "Keep UPI Emails",
      type: "n8n-nodes-base.filter",
      typeVersion: 2.2,
      position: [600, 80],
    },
    {
      parameters: {},
      id: "manual-trigger",
      name: "When clicking Test",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [360, 360],
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        jsCode: sampleCode,
      },
      id: "sample-emails",
      name: "Sample UPI Emails",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [600, 360],
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        jsCode: parseCode,
      },
      id: "parse-upi",
      name: "Parse UPI Transaction",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [840, 200],
    },
    {
      parameters: filterParams(
        [
          {
            id: "is-valid",
            leftValue: "={{ $json.valid }}",
            rightValue: true,
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        "and",
      ),
      id: "keep-valid",
      name: "Keep Valid Txns",
      type: "n8n-nodes-base.filter",
      typeVersion: 2.2,
      position: [1080, 200],
    },
    {
      parameters: {
        mode: "manual",
        duplicateItem: false,
        assignments: {
          assignments: [
            { id: "c-date", name: "Date", value: "={{ $json.Date }}", type: "string" },
            { id: "c-month", name: "Month", value: "={{ $json.Month }}", type: "string" },
            { id: "c-amount", name: "Amount", value: "={{ $json.Amount }}", type: "number" },
            { id: "c-type", name: "Type", value: "={{ $json.Type }}", type: "string" },
            { id: "c-merchant", name: "Merchant", value: "={{ $json.Merchant }}", type: "string" },
            { id: "c-category", name: "Category", value: "={{ $json.Category }}", type: "string" },
            { id: "c-app", name: "App", value: "={{ $json.App }}", type: "string" },
            { id: "c-vpa", name: "VPA", value: "={{ $json.VPA }}", type: "string" },
            { id: "c-ref", name: "UPI_Ref", value: "={{ $json.UPI_Ref }}", type: "string" },
            { id: "c-note", name: "Fun_Note", value: "={{ $json.Fun_Note }}", type: "string" },
            { id: "c-subject", name: "Subject", value: "={{ $json.Subject }}", type: "string" },
            { id: "c-mid", name: "MessageId", value: "={{ $json.MessageId }}", type: "string" },
          ],
        },
        options: {},
      },
      id: "shape-row",
      name: "Shape Sheet Row",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1320, 200],
    },
    {
      parameters: {
        operation: "append",
        documentId: {
          __rl: true,
          value: "YOUR_GOOGLE_SHEET_ID",
          mode: "id",
        },
        sheetName: {
          __rl: true,
          value: "Transactions",
          mode: "name",
        },
        columns: {
          mappingMode: "autoMapInputData",
          value: null,
        },
        options: {},
      },
      id: "append-sheet",
      name: "Append Google Sheet",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: [1560, 200],
      credentials: {
        googleSheetsOAuth2Api: {
          id: "REPLACE_WITH_SHEETS_CREDENTIAL_ID",
          name: "Google Sheets account",
        },
      },
    },
  ],
  connections: {
    "Gmail Trigger": {
      main: [[{ node: "Keep UPI Emails", type: "main", index: 0 }]],
    },
    "Keep UPI Emails": {
      main: [[{ node: "Parse UPI Transaction", type: "main", index: 0 }]],
    },
    "When clicking Test": {
      main: [[{ node: "Sample UPI Emails", type: "main", index: 0 }]],
    },
    "Sample UPI Emails": {
      main: [[{ node: "Parse UPI Transaction", type: "main", index: 0 }]],
    },
    "Parse UPI Transaction": {
      main: [[{ node: "Keep Valid Txns", type: "main", index: 0 }]],
    },
    "Keep Valid Txns": {
      main: [[{ node: "Shape Sheet Row", type: "main", index: 0 }]],
    },
    "Shape Sheet Row": {
      main: [[{ node: "Append Google Sheet", type: "main", index: 0 }]],
    },
  },
  pinData: {},
  settings: {
    executionOrder: "v1",
    callerPolicy: "workflowsFromSameOwner",
  },
  staticData: null,
  tags: [{ name: "upi" }, { name: "gmail" }, { name: "google-sheets" }],
  meta: {
    templateCredsSetupCompleted: false,
  },
};

const outPath = path.join(__dirname, "../n8n/expense-aggregator.json");
fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2));
console.log(`Wrote ${outPath}`);
