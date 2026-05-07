import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { gameId, round } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: game } = await supabase.from("games").select("*").eq("id", gameId).single();
    if (!game) throw new Error("game not found");

    const { data: answers } = await supabase
      .from("answers").select("*").eq("game_id", gameId).eq("round", round);

    const list = answers ?? [];
    if (list.length === 0) {
      await supabase.from("games").update({ status: "results" }).eq("id", gameId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build payload for AI
    const payload = list
      .filter((a: any) => a.value && a.value.trim().length > 0)
      .map((a: any) => ({ id: a.id, category: a.category, value: a.value.trim() }));

    const validityMap: Record<string, boolean> = {};

    if (payload.length > 0) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are a STRICT validator for the word game 'Name Place Animal Thing'. For each answer, mark valid=true ONLY if ALL of these are true:\n1. The word is correctly spelled (real dictionary word, real proper noun, or widely-recognized brand/title — NO misspellings, NO extra/missing letters, NO made-up gibberish like 'jackallllll' or 'jakartyaa').\n2. It is a real, recognizable example of the given category (Name = real human first name; Place = real city/country/region; Animal = real animal species; Thing = real concrete noun/object; Food = real food/dish; Movie = real released film title).\n3. It starts with the required letter (case-insensitive).\nReject anything that is misspelled, fictional gibberish, the wrong category, just letters padded with random characters, or not actually a real example. Be unforgiving on spelling — 'jaket' is NOT 'jacket', reject it. When unsure whether something is a real word, reject it.",
            },
            {
              role: "user",
              content: `Required letter: ${game.current_letter}\nValidate strictly. Items:\n${JSON.stringify(payload)}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "submit_validations",
                description: "Return validity for each answer id",
                parameters: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          valid: { type: "boolean" },
                        },
                        required: ["id", "valid"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["results"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "submit_validations" } },
        }),
      });

      if (aiResp.status === 429) {
        // graceful degrade: accept all letter-matching answers
        for (const a of payload) {
          validityMap[a.id] =
            a.value.trim().toUpperCase().startsWith(game.current_letter.toUpperCase());
        }
      } else if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("AI error:", aiResp.status, t);
        for (const a of payload) {
          validityMap[a.id] =
            a.value.trim().toUpperCase().startsWith(game.current_letter.toUpperCase());
        }
      } else {
        const json = await aiResp.json();
        const call = json.choices?.[0]?.message?.tool_calls?.[0];
        if (call) {
          try {
            const parsed = JSON.parse(call.function.arguments);
            for (const r of parsed.results ?? []) validityMap[r.id] = !!r.valid;
          } catch (e) {
            console.error("parse fail", e);
          }
        }
      }
    }

    // Group by category to detect duplicates (case-insensitive)
    const byCategory: Record<string, { id: string; value: string; valid: boolean }[]> = {};
    for (const a of list) {
      const valid =
        !!a.value &&
        a.value.trim().length > 0 &&
        a.value.trim().toUpperCase().startsWith(game.current_letter.toUpperCase()) &&
        (validityMap[a.id] ?? false);
      if (!byCategory[a.category]) byCategory[a.category] = [];
      byCategory[a.category].push({ id: a.id, value: a.value.trim().toLowerCase(), valid });
    }

    // Score per answer
    const updates: { id: string; status: string; points: number }[] = [];
    for (const cat of Object.keys(byCategory)) {
      const items = byCategory[cat];
      const counts: Record<string, number> = {};
      for (const it of items) if (it.valid) counts[it.value] = (counts[it.value] ?? 0) + 1;
      for (const it of items) {
        if (!it.valid) {
          updates.push({ id: it.id, status: "invalid", points: 0 });
        } else if (counts[it.value] > 1) {
          updates.push({ id: it.id, status: "duplicate", points: 5 });
        } else {
          updates.push({ id: it.id, status: "valid", points: 10 });
        }
      }
    }

    // Apply updates
    for (const u of updates) {
      await supabase.from("answers").update({ status: u.status, points: u.points }).eq("id", u.id);
    }

    // Update player scores: sum of points for this round added to score
    const playerScoreDelta: Record<string, number> = {};
    for (const a of list) {
      const u = updates.find((x) => x.id === a.id);
      if (!u) continue;
      playerScoreDelta[a.player_id] = (playerScoreDelta[a.player_id] ?? 0) + u.points;
    }
    for (const pid of Object.keys(playerScoreDelta)) {
      const { data: p } = await supabase.from("players").select("score").eq("id", pid).single();
      await supabase.from("players").update({ score: (p?.score ?? 0) + playerScoreDelta[pid] }).eq("id", pid);
    }

    await supabase.from("games").update({ status: "results" }).eq("id", gameId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
