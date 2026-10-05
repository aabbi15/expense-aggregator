/**
 * n8n Code node — Run Once for All Items
 * Feeds the parser with realistic Indian UPI emails so you can
 * test the workflow before connecting Gmail.
 */
return [
  {
    json: {
      id: "demo-hdfc-swiggy",
      from: "HDFC Bank Alerts <alerts@hdfcbank.net>",
      subject: "You have done a UPI txn. Check details!",
      date: "2026-10-05T13:05:00+05:30",
      text: "Dear Customer, Rs.249.00 has been debited from account **2732 to VPA swiggy@yesbank SWIGGY on 05-10-26. UPI Ref No 412345678901.",
      snippet: "Rs.249.00 has been debited from account **2732 to VPA swiggy@yesbank SWIGGY",
    },
  },
  {
    json: {
      id: "demo-hdfc-credit",
      from: "HDFC Bank Alerts <alerts@hdfcbank.net>",
      subject: "INR 86.00 credited to your A/c",
      date: "2026-10-04T19:20:00+05:30",
      text: "Rs.86.00 is successfully credited to your account **2732 by VPA varun@okhdfcbank MOTU VARUN P on 04-10-26. UPI Ref 412345678902.",
      snippet: "Rs.86.00 is successfully credited to your account",
    },
  },
  {
    json: {
      id: "demo-phonepe-irctc",
      from: "PhonePe <noreply@phonepe.com>",
      subject: "Paid Rs 185 to IRCTC UTS",
      date: "2026-03-05T20:30:00+05:30",
      text: "Paid To IRCTC UTS ₹ 185\nTxn. ID : T2503052030208914193200\nTxn. Status : Successful\nBank Ref. No. : 224102048209",
      snippet: "Paid To IRCTC UTS ₹ 185",
    },
  },
  {
    json: {
      id: "demo-gpay-uber",
      from: "Google Pay <noreply@google.com>",
      subject: "You paid ₹350 to Uber India",
      date: "2026-10-05T09:12:00+05:30",
      text: "You paid ₹350 to Uber India via UPI. UPI transaction ID: 412345678904. VPA uberindia@okicici",
      snippet: "You paid ₹350 to Uber India via UPI",
    },
  },
  {
    json: {
      id: "demo-paytm-netflix",
      from: "Paytm <no-reply@paytm.com>",
      subject: "Payment successful",
      date: "2026-10-01T08:00:00+05:30",
      text: "Paid ₹199 to Netflix via UPI. UPI Ref No 412345678905. VPA netflix@paytm",
      snippet: "Paid ₹199 to Netflix via UPI",
    },
  },
];
