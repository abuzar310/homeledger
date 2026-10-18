"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, SecondaryButton, TextInput } from "@/components/ui";
import { formatRelativeDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; user_id: string; role: string; display_name: string | null; full_name?: string | null };

export default function MembersPage() {
  const { household, profile, userId, refresh } = useHousehold();
  const [members, setMembers] = useState<Member[]>([]);
  const [code, setCode] = useState("");
  const [join, setJoin] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const joiningRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [codeExpires, setCodeExpires] = useState<string | null>(null);
  const [codeNote, setCodeNote] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState(false);

  async function loadMembers() {
    if (!household) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("household_members")
      .select("id, user_id, role, display_name")
      .eq("household_id", household.id);
    const rows = (data ?? []) as Member[];
    const ids = rows.map((row) => row.user_id);
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    setMembers(rows.map((row) => ({ ...row, full_name: names.get(row.user_id) ?? row.display_name })));
  }

  useEffect(() => {
    if (!household) return;
    const supabase = createClient();
    void loadMembers();
    setCode("");
    setCodeNote(null);
    supabase.rpc("ensure_join_code").then(async ({ data, error: codeError }) => {
      if (codeError || typeof data !== "string") {
        if (codeError && /only the owner/i.test(codeError.message)) setCodeNote("Only the owner can share this home's code.");
        return;
      }
      setCode(data);
      // Codes last a week; a database without the expiry column simply shows no date.
      const { data: row } = await supabase.from("households").select("join_code_expires_at").eq("id", household.id).maybeSingle();
      const expires = (row as { join_code_expires_at?: string | null } | null)?.join_code_expires_at;
      setCodeExpires(expires ?? null);
    });
    // loadMembers only reads household from the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household]);

  const you = members.find((m) => m.user_id === userId);
  const shareText = code
    ? `Join our home on HomeLedger. Sign in at ${typeof window === "undefined" ? "" : window.location.origin}/more/members and enter household code ${code}.`
    : "";

  async function copyCode() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Older browsers or non-secure contexts: fall back to a hidden textarea.
      const el = document.createElement("textarea");
      el.value = code;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      if (!ok) {
        setCopyFailed(true);
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function askToJoin() {
    setError(null);
    setStatus(null);
    const next = join.trim();
    if (!next) return;
    if (code && next === code) {
      setError("That is this household's code. You are already in it.");
      return;
    }
    setConfirmOpen(true);
  }

  // Never throws, so it is safe whether ConfirmDialog awaits it or not.
  async function confirmJoin() {
    if (joiningRef.current) return;
    joiningRef.current = true;
    setJoining(true);
    setError(null);
    setStatus(null);
    try {
      const { data: joined, error: joinError } = await createClient().rpc("join_household", { code: join.trim() });
      if (joinError) {
        setError(
          /too many tries/i.test(joinError.message)
            ? "Too many wrong codes. Wait an hour and try again."
            : /not found/i.test(joinError.message)
              ? "That code was not found or has expired. Ask for a new one."
              : "Could not join right now. Check your connection and try again.",
        );
        return;
      }
      // A wrong or expired code returns nothing (and counts as a try).
      if (!joined) {
        setError("That code was not found or has expired. Ask for a new one.");
        return;
      }
      await refresh();
      setJoin("");
      setStatus("You joined the household.");
    } catch {
      setError("Could not join right now. Check your connection and try again.");
    } finally {
      joiningRef.current = false;
      setJoining(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="space-y-4">
      <ScreenTitle title="Household members" />
      <p className="text-[15px] text-muted">Everyone who joins can add expenses to the same home ledger.</p>
      <Card>
        {!members.length ? (
          <p className="text-muted">{profile?.full_name || "You"} — Owner</p>
        ) : (
          <ul>
            {members.map((member) => (
              <li key={member.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 last:border-0">
                <span className="min-w-0 truncate">
                  {member.full_name || (member.user_id === userId ? "You" : "Member")}
                  {member.user_id === userId ? <span className="text-muted"> (you)</span> : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-muted">{member.role === "owner" ? "Owner" : "Member"}</span>
                  {you?.role === "owner" && member.user_id !== userId ? (
                    <button
                      type="button"
                      className="min-h-11 px-2 text-[14px] font-semibold text-danger"
                      onClick={() => setRemoving(member)}
                    >
                      Remove
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {code ? (
        <Card>
          <p className="text-[13px] text-muted">Household code</p>
          <p className="mt-1 select-all text-[22px] font-semibold tracking-wide">{code}</p>
          <p className="mt-2 text-[15px] text-muted">
            Share this with family. They enter it below after they sign in.
            {codeExpires ? ` It works until ${formatRelativeDay(codeExpires.slice(0, 10))}; after that a new code is made here.` : ""}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <SecondaryButton type="button" onClick={() => void copyCode()} aria-live="polite">
              {copied ? "Copied" : "Copy code"}
            </SecondaryButton>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-surface px-4 text-center text-[16px] font-semibold text-ink"
            >
              Share on WhatsApp
            </a>
          </div>
          {copyFailed ? (
            <p className="mt-2 text-[15px] text-danger">Could not copy. Press and hold the code to copy it.</p>
          ) : null}
        </Card>
      ) : codeNote ? (
        <p className="text-[15px] text-muted">{codeNote}</p>
      ) : null}
      <Card className="space-y-3">
        <Field label="Join another household">
          <TextInput
            value={join}
            onChange={(e) => setJoin(e.target.value.toUpperCase())}
            placeholder="Household code"
            disabled={joining}
          />
        </Field>
        {error ? <p className="text-[15px] text-danger">{error}</p> : null}
        {status ? <p className="text-[15px] text-accent">{status}</p> : null}
        <PrimaryButton type="button" disabled={joining || !join.trim()} onClick={askToJoin}>
          {joining ? "Joining…" : "Join household"}
        </PrimaryButton>
        {you?.role === "member" ? <p className="text-[13px] text-muted">You are a member of this home.</p> : null}
      </Card>
      {members.length > 1 ? (
        <button type="button" className="min-h-12 w-full text-[15px] font-semibold text-danger" onClick={() => setLeaving(true)}>
          Leave this household
        </button>
      ) : null}
      <ConfirmDialog
        open={removing != null}
        title={`Remove ${removing?.full_name || "this member"}?`}
        body="They lose access to this home's expenses. Expenses they added stay, just without their name on them."
        confirmLabel="Remove"
        busyLabel="Removing…"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          const { error: removeError } = await createClient().rpc("remove_member", { p_member: removing.id });
          if (removeError) throw removeError;
          setStatus(`${removing.full_name || "The member"} was removed.`);
          await loadMembers();
        }}
      />
      <ConfirmDialog
        open={leaving}
        title="Leave this household?"
        body={
          you?.role === "owner"
            ? "You stop seeing its expenses. If nobody else is an owner, the longest-standing member becomes one. The expenses stay with the home."
            : "You stop seeing its expenses. The expenses stay with the home."
        }
        confirmLabel="Leave"
        busyLabel="Leaving…"
        danger
        onClose={() => setLeaving(false)}
        onConfirm={async () => {
          if (!household) return;
          const { error: leaveError } = await createClient().rpc("leave_household", { p_household: household.id });
          if (leaveError) throw leaveError;
          await refresh();
          setStatus("You left the household.");
        }}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Join this household?"
        body={`HomeLedger will switch to the household with code ${join.trim()} and show its expenses instead of this one's. Your current expenses stay saved, but they won't show here after you switch. If this home was never used (no expenses, bills, budgets or stores), it is removed.`}
        confirmLabel={joining ? "Joining…" : "Join household"}
        onConfirm={confirmJoin}
        onClose={() => {
          if (!joiningRef.current) setConfirmOpen(false);
        }}
      />
    </div>
  );
}
