"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, SecondaryButton, TextInput } from "@/components/ui";
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

  useEffect(() => {
    if (!household) return;
    const supabase = createClient();
    supabase
      .from("household_members")
      .select("id, user_id, role, display_name")
      .eq("household_id", household.id)
      .then(async ({ data }) => {
        const rows = (data ?? []) as Member[];
        const ids = rows.map((row) => row.user_id);
        const { data: profiles } = ids.length
          ? await supabase.from("profiles").select("id, full_name").in("id", ids)
          : { data: [] };
        const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
        setMembers(rows.map((row) => ({ ...row, full_name: names.get(row.user_id) ?? row.display_name })));
      });
    supabase.rpc("ensure_join_code").then(({ data, error: codeError }) => {
      if (!codeError && typeof data === "string") setCode(data);
    });
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
      const { error: joinError } = await createClient().rpc("join_household", { code: join.trim() });
      if (joinError) {
        setError(
          /not found/i.test(joinError.message)
            ? "That code was not found. Check it and try again."
            : "Could not join right now. Check your connection and try again.",
        );
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
              <li key={member.id} className="flex justify-between border-b border-line py-3 last:border-0">
                <span>{member.full_name || (member.user_id === userId ? "You" : "Member")}</span>
                <span className="text-muted">{member.role === "owner" ? "Owner" : "Member"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {code ? (
        <Card>
          <p className="text-[13px] text-muted">Household code</p>
          <p className="mt-1 select-all text-[22px] font-semibold tracking-wide">{code}</p>
          <p className="mt-2 text-[15px] text-muted">Share this with family. They enter it below after they sign in.</p>
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
      ) : null}
      <Card className="space-y-3">
        <Field label="Join another household">
          <TextInput
            value={join}
            onChange={(e) => setJoin(e.target.value.toUpperCase())}
            placeholder="ABC123"
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
      <ConfirmDialog
        open={confirmOpen}
        title="Join this household?"
        body={`HomeLedger will switch to the household with code ${join.trim()} and show its expenses instead of this one's. Your current expenses stay saved, but they won't show here after you switch. If this home has no expenses yet, it is removed, along with its budgets and bills.`}
        confirmLabel={joining ? "Joining…" : "Join household"}
        onConfirm={confirmJoin}
        onClose={() => {
          if (!joiningRef.current) setConfirmOpen(false);
        }}
      />
    </div>
  );
}
