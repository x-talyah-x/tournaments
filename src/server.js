// Supabase Configuration
const SUPABASE_URL = "https://fetpncdjrmfknofvekqc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldHBuY2Rqcm1ma25vZnZla3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDE3NDEsImV4cCI6MjEwMjM3Nzc0MX0.oiKiVJ8u18g0G4XOmjcBaDGdezRwVuMqmVRI3e80V0E"; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let tournamentsData = [];
let availableProfiles = [];
let isAdmin = false;

// Initialize app data on load
document.addEventListener('DOMContentLoaded', async () => {
  await fetchProfiles();
  await loadTournaments();
});

// Fetch all profiles to populate registration dropdowns
async function fetchProfiles() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, player_name')
    .order('player_name', { ascending: true });

  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    availableProfiles = data || [];
  }
}

// 1. Fetch Tournaments, Entries, and Joined Profiles
async function loadTournaments() {
  const container = document.getElementById('tournaments-container');
  if (!container) return;

  const { data, error } = await supabaseClient
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
    .order('event_date', { ascending: true });

  if (error) {
    console.error("Error fetching tournaments:", error);
    container.innerHTML = `<p style="text-align:center; color:var(--danger);">Failed to load tournaments.</p>`;
    return;
  }

  tournamentsData = data || [];
  renderTournaments();
}

// Helper to format ISO dates cleanly
function formatTournamentDate(isoString) {
  if (!isoString) return 'Date TBD';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date); 
}

// Helper to calculate date grouping category
function getDateCategory(isoString) {
  if (!isoString) return 'Upcoming';
  
  const now = new Date();
  const eventDate = new Date(isoString);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

  const diffTime = eventDay - today;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Past Events';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 7) return 'Next Week';
  return 'Later';
}

// 2. Render Tournaments & Participant Tables Grouped by Date Category
// Clear date filter helper
// Clear date filter helper
function clearDateFilter() {
  const filterInput = document.getElementById('date-filter');
  if (filterInput) {
    filterInput.value = '';
    renderTournaments();
  }
}

// Updated renderTournaments function with period-based filtering
function renderTournaments() {
  const container = document.getElementById('tournaments-container');
  if (!container) return;

  const filterPeriod = document.getElementById('date-filter')?.value;

  // Filter tournaments matching the selected timeframe
  const filteredData = tournamentsData.filter(t => {
    if (!filterPeriod) return true;
    if (!t.event_date) return false;

    const now = new Date();
    const eventDate = new Date(t.event_date);

    // Normalize dates to start of day for accurate comparisons
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    const diffDays = Math.round((eventDay - today) / (1000 * 60 * 60 * 24));

    if (filterPeriod === 'today') {
      return diffDays === 0;
    }

    if (filterPeriod === 'tomorrow') {
      return diffDays === 1;
    }

    if (filterPeriod === 'this_week') {
      // Days remaining in current calendar week (Sunday - Saturday)
      const daysUntilEndOfWeek = 6 - today.getDay();
      return diffDays >= 0 && diffDays <= daysUntilEndOfWeek;
    }

    if (filterPeriod === 'this_month') {
      return (
        eventDay >= today &&
        eventDate.getMonth() === now.getMonth() &&
        eventDate.getFullYear() === now.getFullYear()
      );
    }

    return true;
  });

  if (filteredData.length === 0) {
    container.innerHTML = filterPeriod 
      ? `<p style="text-align:center; color:#64748b;">No tournaments found for this timeframe.</p>`
      : `<p style="text-align:center; color:#64748b;">No active tournaments scheduled.</p>`;
    return;
  }

  const categoriesOrder = ['Today', 'Tomorrow', 'Next Week', 'Later', 'Past Events', 'Upcoming'];
  const groupedTournaments = {};

  filteredData.forEach(t => {
    const category = getDateCategory(t.event_date);
    if (!groupedTournaments[category]) groupedTournaments[category] = [];
    groupedTournaments[category].push(t);
  });

  let htmlContent = '';

  const profileOptionsHtml = availableProfiles.length > 0
    ? availableProfiles.map(p => 
        `<option value="${p.id}">${escapeHtml(p.player_name || 'Unnamed')}</option>`
      ).join('')
    : `<option value="" disabled>No profiles found</option>`;

  categoriesOrder.forEach(category => {
    if (groupedTournaments[category] && groupedTournaments[category].length > 0) {
      htmlContent += `
        <div style="margin: 1.5rem 0 0.75rem 0; padding-bottom: 4px; border-bottom: 1px solid var(--border);">
          <h3 style="color: var(--gold); margin: 0; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.5px;">
            📌 ${category}
          </h3>
        </div>
      `;

      htmlContent += groupedTournaments[category].map(t => {
        const entries = t.registrations || [];
        const formattedDate = formatTournamentDate(t.event_date);
        const tournamentName = t.name ? escapeHtml(t.name) : escapeHtml((t.game_type || '').toUpperCase());
        
        return `
          <div class="tournament-card">
            <div class="tournament-card-header">
              <div>
                <h4>${tournamentName}</h4>
                <span style="color: var(--accent); font-weight: 600; font-size: 0.9rem;">📅 ${escapeHtml(formattedDate)}</span>
              </div>
              ${isAdmin ? `<button class="btn btn-danger" onclick="deleteTournament('${t.id}')">Delete</button>` : ''}
            </div>

            <div class="tournament-badge-row">
              <span class="badge">Game: ${escapeHtml(t.game_type || '')}</span>
              <span class="badge">Format: ${escapeHtml(t.format || '')}</span>
              <span class="badge">${escapeHtml(t.race_to || '')}</span>
              <span class="badge">Entries: ${entries.length}</span>
            </div>

            <form class="signup-form" onsubmit="handleSignup(event, '${t.id}')" style="display: flex; gap: 8px; margin-top: 1rem;">
              <select class="select-field" id="p-select-${t.id}" required style="flex: 1;">
                <option value="" disabled selected>Select Player Profile...</option>
                ${profileOptionsHtml}
              </select>
              <button type="submit" class="btn btn-primary">Join</button>
            </form>

            ${entries.length > 0 ? `
              <div class="table-wrapper">
                <table class="leaderboard">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
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
                          <td class="admin-col">
                            <button class="btn btn-danger" onclick="removeParticipant('${entry.id}')">✕</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `<p style="font-size: 0.85rem; color: #64748b; margin-top: 1rem;">No entries yet. Be the first to register!</p>`}
          </div>
        `;
      }).join('');
    }
  });

  container.innerHTML = htmlContent;
}
// 3. Admin Actions
async function handleCreateTournament(event) {
  event.preventDefault();

  const name = document.getElementById('t-name').value.trim();
  const eventDate = document.getElementById('t-date').value;
  const gameType = document.getElementById('t-game').value;
  const raceNumber = parseInt(document.getElementById('t-race').value, 10);
  const format = document.getElementById('t-format').value;

  const raceToText = `Race to ${raceNumber}`;

  const { error } = await supabaseClient
    .from('tournaments')
    .insert([
      { 
        name: name,
        event_date: eventDate, 
        game_type: gameType, 
        race_to: raceToText, 
        format: format 
      }
    ]);

  if (error) {
    alert('Error publishing tournament: ' + error.message);
  } else {
    event.target.reset();
    await loadTournaments();
  }
}

async function deleteTournament(id) {
  if (confirm("Are you sure you want to delete this tournament and all its entries?")) {
    const { error } = await supabaseClient
      .from('tournaments')
      .delete()
      .eq('id', id);

    if (!error) await loadTournaments();
  }
}

// 4. Participant Actions (Registers selected profile)
async function handleSignup(e, tournamentId) {
  e.preventDefault();
  const selectElement = document.getElementById(`p-select-${tournamentId}`);
  const playerId = selectElement ? selectElement.value : null;

  if (!playerId) {
    alert("Please select a valid player profile.");
    return;
  }

  const { error } = await supabaseClient
    .from('registrations')
    .insert([{ 
      tournament_id: tournamentId, 
      profile_id: playerId 
    }]);

  if (error) {
    console.error("Error signing up:", error);
    
    // Code 23505 or duplicate key violation message check
    if (error.code === '23505' || error.message.includes('unique constraint')) {
      alert("User already registered for this tournament.");
    } else {
      alert("Failed to add entry: " + error.message);
    }
  } else {
    await loadTournaments();
  }
}
async function removeParticipant(entryId) {
  if (confirm("Remove participant?")) {
    const { error } = await supabaseClient
      .from('registrations')
      .delete()
      .eq('id', entryId);

    if (!error) await loadTournaments();
  }
}

// 5. Admin Authentication UI Toggle
function toggleAdminPrompt() {
  if (isAdmin) { 
    logoutAdmin(); 
    return; 
  }
  
  const inputPass = prompt("Admin Password:");
  if (inputPass) {
    isAdmin = true;
    document.getElementById('app-body')?.classList.add('admin-mode-active');
    document.getElementById('admin-panel')?.classList.add('visible');
    const label = document.getElementById('admin-btn-label');
    if (label) label.innerText = 'Exit Edit Mode';
    renderTournaments();
  }
}

function logoutAdmin() {
  isAdmin = false;
  document.getElementById('app-body')?.classList.remove('admin-mode-active');
  document.getElementById('admin-panel')?.classList.remove('visible');
  const label = document.getElementById('admin-btn-label');
  if (label) label.innerText = 'Admin Login';
  renderTournaments();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// Toggle Profile Panel Visibility
function togglePlayerProfilePanel() {
  const panel = document.getElementById('player-panel');
  if (panel) {
    panel.classList.toggle('visible');
  }
}

// Save New Player Profile to Supabase
async function handleSavePlayerProfile(event) {
  event.preventDefault();

  const playerName = document.getElementById('p-name').value.trim();
  const gender = document.getElementById('p-gender').value;
  const age = parseInt(document.getElementById('p-age').value, 10);

  if (!playerName || !gender || !age) {
    alert("Please fill in all profile fields.");
    return;
  }

  const { data, error } = await supabaseClient
    .from('profiles')
    .insert([
      { 
        player_name: playerName, 
        gender: gender, 
        age: age 
      }
    ])
    .select();

  if (error) {
    console.error("Error saving profile:", error);
    
    // Check for unique constraint violation (PostgreSQL code 23505)
    if (error.code === '23505' || error.message.includes('unique constraint')) {
      alert("user already exists");
    } else {
      alert("Error saving profile: " + error.message);
    }
  } else {
    alert("Profile created successfully!");
    event.target.reset();
    togglePlayerProfilePanel();
    
    // Refresh profiles dropdown list & tournaments UI
    await fetchProfiles();
    renderTournaments();
  }
}


