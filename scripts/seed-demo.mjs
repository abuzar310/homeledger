import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_EMAIL;
if (!url || !key || !email) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_EMAIL");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data: users } = await supabase.auth.admin.listUsers();
const user = users.users.find((u) => u.email === email);
if (!user) {
  console.error("Seed user not found");
  process.exit(1);
}

const { data: member } = await supabase
  .from("household_members")
  .select("household_id, id")
  .eq("user_id", user.id)
  .single();
if (!member) {
  console.error("Household not found");
  process.exit(1);
}

const samples = [
  { name: "Nandini Milk", amount: 54, occurred_on: "2026-09-22", category: "Groceries", sub: "Dairy" },
  { name: "Amazon Kitchen Rack", amount: 1299, occurred_on: "2026-09-22", category: "Kitchen", sub: "Kitchen" },
  { name: "Swiggy Biryani", amount: 480, occurred_on: "2026-09-21", category: "Dining & Food", sub: "Food Delivery" },
  { name: "BESCOM Electricity", amount: 2140, occurred_on: "2026-09-21", category: "Utilities", sub: "Electricity" },
  { name: "Petrol", amount: 1500, occurred_on: "2026-09-20", category: "Transport", sub: "Fuel" },
  { name: "Vegetables", amount: 380, occurred_on: "2026-09-20", category: "Groceries", sub: "Vegetables" },
  { name: "Netflix", amount: 649, occurred_on: "2026-09-18", category: "Entertainment", sub: "Subscriptions" },
  { name: "Doctor Consultation", amount: 700, occurred_on: "2026-09-16", category: "Health", sub: "Doctor" },
  { name: "Rice", amount: 700, occurred_on: "2026-09-15", category: "Groceries", sub: "Staples" },
  { name: "Cooking Oil", amount: 500, occurred_on: "2026-09-15", category: "Groceries", sub: "Staples" },
];

const { data: categories } = await supabase.from("categories").select("id, name");
const { data: subcategories } = await supabase.from("subcategories").select("id, name, category_id");

for (const sample of samples) {
  const category = categories.find((c) => c.name === sample.category);
  const sub = subcategories.find((s) => s.name === sample.sub && s.category_id === category?.id);
  await supabase.from("transactions").insert({
    household_id: member.household_id,
    member_id: member.id,
    created_by: user.id,
    name: sample.name,
    amount: sample.amount,
    occurred_on: sample.occurred_on,
    category_id: category?.id ?? null,
    subcategory_id: sub?.id ?? null,
    categorization_source: "rule",
    categorization_confidence: 0.9,
    needs_review: false,
    client_request_id: crypto.randomUUID(),
  });
}

console.log("Seeded demo expenses");
