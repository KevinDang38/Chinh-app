import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: Missing Authorization header');
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) throw new Error(`Auth Error: ${authError.message}`);
    if (!user) throw new Error('Unauthorized: No user found');

    const { 
      isLive, lobbyPin, matchType, scoreA, scoreB, 
      playerAId, partnerId, opp1Id, opp2Id 
    } = await req.json();

    if (scoreA === undefined || scoreB === undefined) throw new Error('Scores are required');

    const playerIds = [playerAId, partnerId, opp1Id, opp2Id].filter(Boolean);
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, rating')
      .in('id', playerIds);

    if (profileError || !profiles) throw new Error('Failed to fetch profiles');

    const getRating = (id: string | null) => {
      if (!id) return 3.5; 
      const p = profiles.find((prof: any) => prof.id === id);
      return p ? Number(p.rating) : 3.5;
    };

    let pA = getRating(playerAId);
    let pB = getRating(partnerId);
    let o1 = getRating(opp1Id);
    let o2 = getRating(opp2Id);

    const teamARating = matchType === '2v2' ? (pA + pB) / 2 : pA;
    const teamBRating = matchType === '2v2' ? (o1 + o2) / 2 : o1;

    const expectedPerformanceA = 1 / (1 + Math.pow(10, (teamBRating - teamARating) / 1.0));
    const expectedPerformanceB = 1 / (1 + Math.pow(10, (teamARating - teamBRating) / 1.0));
    
    const totalPoints = scoreA + scoreB;
    const actualPointsPctA = scoreA / totalPoints;
    const actualPointsPctB = scoreB / totalPoints;
    
    const isWinnerA = scoreA > scoreB;
    const matchResultA = isWinnerA ? 1 : 0;
    const matchResultB = isWinnerA ? 0 : 1;

    const actualPerformanceA = (matchResultA * 0.7) + (actualPointsPctA * 0.3);
    const actualPerformanceB = (matchResultB * 0.7) + (actualPointsPctB * 0.3);

    const getKFactor = async (pid: string) => {
       if (!pid) return 0.1;
       const { count } = await supabaseAdmin
         .from('matches')
         .select('*', { count: 'exact', head: true })
         .or(`player_a_id.eq.${pid},team_a_player2_id.eq.${pid},team_b_player1_id.eq.${pid},team_b_player2_id.eq.${pid}`);
       if (count !== null && count < 10) return 0.2;
       if (count !== null && count >= 40) return 0.05;
       return 0.1;
    };

    const kA = await getKFactor(playerAId);
    const ratingChangeA = kA * (actualPerformanceA - expectedPerformanceA);

    // Write match data first to eliminate frontend lookup latency
    await supabaseAdmin.from('matches').insert([{ 
      match_type: matchType,
      player_a_id: playerAId, 
      team_a_player2_id: partnerId || null,
      team_b_player1_id: opp1Id || null,
      team_b_player2_id: opp2Id || null,
      player_a_score: scoreA, 
      player_b_score: scoreB,
      rating_change: ratingChangeA 
    }]);

    if (isLive && lobbyPin) {
      await supabaseAdmin.from('match_lobbies').update({ 
        status: 'completed' 
      }).eq('pin', lobbyPin);
    }

    const updateRating = async (id: string | null, currentRating: number, actualPerf: number, expectedPerf: number) => {
        if(!id) return null;
        const k = await getKFactor(id);
        const change = k * (actualPerf - expectedPerf);
        const newR = Number((currentRating + change).toFixed(3));
        await supabaseAdmin.from('profiles').update({ rating: newR }).eq('id', id);
        return newR;
    };

    const finalA = await updateRating(playerAId, pA, actualPerformanceA, expectedPerformanceA);
    await updateRating(partnerId, pB, actualPerformanceA, expectedPerformanceA);
    const finalO1 = await updateRating(opp1Id, o1, actualPerformanceB, expectedPerformanceB);
    await updateRating(opp2Id, o2, actualPerformanceB, expectedPerformanceB);

    return new Response(JSON.stringify({ 
      success: true, 
      newRating: finalA, 
      newRatingA: finalA, 
      newRatingB: finalO1 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});