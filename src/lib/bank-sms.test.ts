import { describe, expect, it } from "vitest";
import { looksLikeBankSms, parseBankSms } from "./bank-sms";

describe("parseBankSms", () => {
  it("reads an HDFC UPI alert", () => {
    const sms = "Sent Rs.540.00\nFrom HDFC Bank A/C *1234\nTo NANDINI MILK PARLOUR\nOn 17/10/26\nRef 629012345678\nNot You? Call 18002586161";
    expect(parseBankSms(sms)).toEqual({
      kind: "debit",
      amount: 540,
      payee: "Nandini Milk Parlour",
      occurredOn: "2026-10-17",
      paymentHint: null,
    });
  });

  it("reads an SBI UPI debit", () => {
    const sms = "Dear UPI user A/C X1234 debited by 250.0 on date 17Oct26 trf to SWIGGY Refno 629012345678. If not u? call 1800111109. -SBI";
    expect(parseBankSms(sms)).toEqual({ kind: "debit", amount: 250, payee: "Swiggy", occurredOn: "2026-10-17", paymentHint: "UPI" });
  });

  it("reads an ICICI debit with the payee before 'credited'", () => {
    const sms = "ICICI Bank Acct XX123 debited for Rs 1,200.00 on 17-Oct-26; AMAZON PAY credited. UPI:629012345678. Call 18002662 for dispute.";
    expect(parseBankSms(sms)).toMatchObject({ kind: "debit", amount: 1200, payee: "Amazon Pay", occurredOn: "2026-10-17", paymentHint: "UPI" });
  });

  it("reads an Axis UPI alert", () => {
    const sms = "INR 499.00 debited from A/c no. XX1234 on 17-10-2026 at 10:22:11 IST. Info- UPI/P2M/629012345678/ZOMATO. Not you? SMS BLOCK";
    expect(parseBankSms(sms)).toMatchObject({ kind: "debit", amount: 499, payee: "Zomato", occurredOn: "2026-10-17" });
  });

  it("reads a credit card spend", () => {
    const sms = "Rs.1,250.00 spent on your HDFC Bank Credit Card ending 1234 at AMAZON on 2026-10-17:10:20:30. Not you? Call 18002586161";
    expect(parseBankSms(sms)).toEqual({
      kind: "debit",
      amount: 1250,
      payee: "Amazon",
      occurredOn: "2026-10-17",
      paymentHint: "Credit Card",
    });
  });

  it("reads a GPay-style payment", () => {
    expect(parseBankSms("You paid ₹120 to Ramesh Kumar")).toMatchObject({ kind: "debit", amount: 120, payee: "Ramesh Kumar" });
  });

  it("recognises money received", () => {
    expect(parseBankSms("Rs 5,000 credited to your A/c XX1234 on 17-10-26 by UPI ref 629012345678")).toEqual({ kind: "credit" });
  });

  it("leaves typed expenses alone", () => {
    expect(looksLikeBankSms("Milk 54")).toBe(false);
    expect(parseBankSms("Swiggy biryani 450 UPI")).toBeNull();
  });
});
