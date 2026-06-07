import { supabase } from "./supabaseClient";

// 🚀 NEW: Infinitely scalable seed generator algorithm
// Generates the perfect standard distribution for ANY bracket size (2, 4, 8... 128, 256, etc.)
const generateDynamicSeedOrder = (bracketSize) => {
  if (bracketSize <= 1) return [1];
  let matches = [1, 2];
  
  for (let currentSize = 4; currentSize <= bracketSize; currentSize *= 2) {
    const nextMatches = [];
    for (let i = 0; i < matches.length; i++) {
      nextMatches.push(matches[i]);
      // The opposing seed is always (current bracket size - current seed + 1)
      nextMatches.push(currentSize - matches[i] + 1); 
    }
    matches = nextMatches;
  }
  return matches;
};

export const generateTournamentBracket = async (eventId, eventType) => {
  // 1. Fetch all participants joined to this event, including their profiles for DUPR ratings
  const { data: participants, error: fetchError } = await supabase
    .from('event_participants')
    .select('user_id, profiles(rating)')
    .eq('event_id', eventId);

  if (fetchError || !participants || participants.length < 2) {
    throw new Error("Not enough players to generate a bracket.");
  }

  // 2. Sort participants by DUPR Rating (Highest to Lowest) to determine Seeds
  const seededPlayers = participants.sort((a, b) => b.profiles.rating - a.profiles.rating);

  // 3. Determine Bracket Size (Next power of 2)
  const numPlayers = seededPlayers.length;
  let bracketSize = 2;
  while (bracketSize < numPlayers) { bracketSize *= 2; }
  
  const totalRounds = Math.log2(bracketSize);
  const matchesToInsert = [];

  const generateUUID = () => crypto.randomUUID();

  // We build the bracket from the FINAL round backwards to the FIRST round
  let currentRoundMatches = [];
  let nextRoundMatches = [];

  for (let round = totalRounds; round >= 1; round--) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    currentRoundMatches = [];

    for (let i = 0; i < matchesInRound; i++) {
      const matchId = generateUUID();
      
      let nextMatchId = null;
      if (round < totalRounds) {
        nextMatchId = nextRoundMatches[Math.floor(i / 2)].id;
      }

      const matchNode = {
        id: matchId,
        event_id: eventId,
        round_number: round,
        match_index: i,
        next_match_id: nextMatchId,
        status: 'pending',
        player_a_id: null,
        team_b_player1_id: null 
      };

      currentRoundMatches.push(matchNode);
      matchesToInsert.push(matchNode);
    }
    nextRoundMatches = currentRoundMatches;
  }

  // 4. Fill Round 1 with the Seeded Players using the dynamic algorithm
  const round1Nodes = matchesToInsert.filter(m => m.round_number === 1).sort((a, b) => a.match_index - b.match_index);
  
  // 🚀 Fetch the dynamic pattern instantly regardless of tournament size
  const pattern = generateDynamicSeedOrder(bracketSize);

  for (let i = 0; i < round1Nodes.length; i++) {
    const seedA = pattern[i * 2] - 1; 
    const seedB = pattern[i * 2 + 1] - 1;

    // Assign Player A
    if (seedA < numPlayers) round1Nodes[i].player_a_id = seededPlayers[seedA].user_id;
    
    // Assign Player B or trigger an automatic BYE
    if (seedB < numPlayers) {
        round1Nodes[i].team_b_player1_id = seededPlayers[seedB].user_id;
    } else {
        round1Nodes[i].status = 'completed';
        round1Nodes[i].winner_team = 'team_a';
    }
  }

  // 5. Insert everything into Supabase
  // Note: Supabase handles up to a few thousand rows per bulk insert perfectly. 
  // A 512-player tournament creates 511 match rows, well within limits.
  const { error: insertError } = await supabase.from('tournament_matches').insert(matchesToInsert);
  if (insertError) throw new Error("Failed to save bracket: " + insertError.message);

  // 6. Lock the Event
  await supabase.from('events').update({ bracket_stage: 'live' }).eq('id', eventId);

  return true;
};