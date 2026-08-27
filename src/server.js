// Supabase Configuration
const SUPABASE_URL = "https://fetpncdjrmfknofvekqc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldHBuY2Rqcm1ma25vZnZla3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDE3NDEsImV4cCI6MjEwMjM3Nzc0MX0.oiKiVJ8u18g0G4XOmjcBaDGdezRwVuMqmVRI3e80V0E"; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let availableProfiles = [];

// Helper function to safely render text
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initial Load
document.addEventListener('DOMContentLoaded', async () => {
  await fetchProfiles();
  await loadTournaments();
});

// Fetch Profiles from the profiles table
async function fetchProfiles() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, player_name, age, gender')
    .order('player_name', { ascending: true });

  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    availableProfiles = data || [];
  }
}

// Fetch Tournaments joined with Registrations and Profiles
async function loadTournaments() {
  const { data: tournaments, error } = await supabaseClient
    .from('tournaments')
    .select(`
      *,
      registrations (
        id,
        created_at,
        profiles (
          id,
          player_name,
          age,
          gender
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading tournaments:', error);
    return;
  }

  renderTournaments(tournaments || []);
}

// Render Tournaments and Entries
function renderTournaments(tournaments) {
  const container = document.getElementById('tournaments-list');
  if (!container) return;

  if (tournaments.length === 0) {
    container.innerHTML = `<p>No tournaments scheduled.</p>`;
    return;
  }

  container.innerHTML = tournaments.map(t => {
    const entries = t.registrations || [];

    // Profile Dropdown Options
    const profileOptions = availableProfiles.map(p => 
      `<option value="${p.id}">${escapeHtml(p.player_name)} (${p.age || '-'}, ${p.gender || '-'})</option>`
    ).join('');

    return `
      <div class="tournament-card" style="border: 1px solid #334155; padding: 1.5rem; margin-bottom: 1.5rem; border-radius: 8px;">
        <h2>${escapeHtml(t.name || 'Untitled Tournament')}</h2>
        <p style="color: #94a3b8; font-size: 0.9rem;">${escapeHtml(t.game_type || '')} | ${escapeHtml(t.format || '')}</p>

        <!-- Player Registration Form -->
        <form class="signup-form" onsubmit="handleSignup(event, '${t.id}')">
          <select class="select-field" id="p-select-${t.id}" required>
            <option value="" disabled selected>Select Player Profile...</option>
            ${profileOptions}
          </select>
          <button type="submit" class="btn btn-primary">Join Tournament</button>
        </form>

        <!-- Participant List -->
        ${entries.length > 0 ? `
          <div class="table-wrapper">
            <table class="leaderboard">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th class="admin-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map((entry, idx) => {
                  const profile = entry.profiles || {};
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><strong>${escapeHtml(profile.player_name || 'Unknown')}</strong></td>
                      <td>${escapeHtml(profile.age ? String(profile.age) : '-')}</td>
                      <td>
                        <span class="badge" style="background:#1e293b; color:#38bdf8;">
                          ${escapeHtml(profile.gender || '-')}
                        </span>
                      </td>
                      <td class="admin-col">
                        <button class="btn btn-danger" onclick="removeParticipant('${entry.id}')">✕</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `<p style="font-size: 0.85rem; color: #64748b; margin-top: 1rem;">No entries yet. Select a player profile to register!</p>`}
      </div>
    `;
  }).join('');
}

// Handle Registering a Player Profile to a Tournament
async function handleSignup(e, tournamentId) {
  e.preventDefault();
  const selectElement = document.getElementById(`p-select-${tournamentId}`);
  const playerId = selectElement ? selectElement.value : null;

  if (!playerId) {
    alert("Please select a player profile.");
    return;
  }

  const { error } = await supabaseClient
    .from('registrations')
    .insert([{ 
      tournament_id: tournamentId, 
      player_id: playerId 
    }]);

  if (error) {
    console.error("Error signing up:", error);
    alert("Failed to register player: " + error.message);
  } else {
    await loadTournaments();
  }
}

// Remove Participant from Tournament
async function removeParticipant(registrationId) {
  if (!confirm("Are you sure you want to remove this player?")) return;

  const { error } = await supabaseClient
    .from('registrations')
    .delete()
    .eq('id', registrationId);

  if (error) {
    console.error("Error removing participant:", error);
    alert("Failed to remove participant.");
  } else {
    await loadTournaments();
  }
}
