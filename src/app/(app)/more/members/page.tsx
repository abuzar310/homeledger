"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; user_id: string; role: string; display_name: string | null; full_name?: string | null };

export default function MembersPage() {
  const { household, profile, userId, refresh } = useHousehold();
  const [members, setMembers] = useState<Member[]>([]);
  const [code, setCode] = useState("");
  const [join, setJoin] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <p className="mt-1 text-[22px] font-semibold tracking-wide">{code}</p>
          <p className="mt-2 text-[15px] text-muted">Share this with family. They enter it below after they sign in.</p>
        </Card>
      ) : null}
      <Card className="space-y-3">
        <Field label="Join another household">
          <TextInput value={join} onChange={(e) => setJoin(e.target.value.toUpperCase())} placeholder="ABC123" />
        </Field>
        {error ? <p className="text-[15px] text-danger">{error}</p> : null}
        {status ? <p className="text-[15px] text-accent">{status}</p> : null}
        <PrimaryButton
          onClick={async () => {
            setError(null);
            setStatus(null);
            const { error: joinError } = await createClient().rpc("join_household", { code: join.trim() });
            if (joinError) {
              setError("That code was not found. Check it and try again.");
              return;
            }
            await refresh();
            setStatus("You joined the household.");
          }}
        >
          Join household
        </PrimaryButton>
        {you?.role === "member" ? <p className="text-[13px] text-muted">You are a member of this home.</p> : null}
      </Card>
    </div>
  );
}
