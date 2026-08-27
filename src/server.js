// Supabase Configuration
const SUPABASE_URL = "https://fetpncdjrmfknofvekqc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldHBuY2Rqcm1ma25vZnZla3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDE3NDEsImV4cCI6MjEwMjM3Nzc0MX0.oiKiVJ8u18g0G4XOmjcBaDGdezRwVuMqmVRI3e80V0E"; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let tournamentsData = [];
let isAdmin = false;

// 1. Fetch Tournaments and Entries (Ordered chronologically by event date)
async function loadTournaments() {
  const container = document.getElementById('tournaments-container');
  if (!container) return;

  const { data, error } = await supabaseClient
    .from('tournaments')
    .select(`
      *,
      registrations (*)
    `)
    .order('event_date', { ascending: true }); // Primary sort by event date

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

// Helper to calculate date grouping category (Today, Tomorrow, Next Week, Later, Past)
function getDateCategory(isoString) {
  if (!isoString) return 'Upcoming';
  
  const now = new Date();
  const eventDate = new Date(isoString);

  // Normalize to local midnight for accurate calendar day comparison
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
function renderTournaments() {
  const container = document.getElementById('tournaments-container');
  if (!container) return;

  if (tournamentsData.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:#64748b;">No active tournaments scheduled.</p>`;
    return;
  }

  // Group tournaments into categories while maintaining chronological order
  const categoriesOrder = ['Today', 'Tomorrow', 'Next Week', 'Later', 'Past Events', 'Upcoming'];
  const groupedTournaments = {};

  tournamentsData.forEach(t => {
    const category = getDateCategory(t.event_date);
    if (!groupedTournaments[category]) groupedTournaments[category] = [];
    groupedTournaments[category].push(t);
  });

  let htmlContent = '';

  categoriesOrder.forEach(category => {
    if (groupedTournaments[category] && groupedTournaments[category].length > 0) {
      // Add Category Section Header
      htmlContent += `
        <div style="margin: 1.5rem 0 0.75rem 0; padding-bottom: 4px; border-bottom: 1px solid var(--border);">
          <h3 style="color: var(--gold); margin: 0; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.5px;">
            📌 ${category}
          </h3>
        </div>
      `;

      // Render Cards within Category
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

            <!-- Participant Signup Form -->
            <form class="signup-form" onsubmit="handleSignup(event, '${t.id}')">
              <input type="text" class="input-field" id="p-name-${t.id}" placeholder="Player Name" required>
              <input type="text" class="input-field" id="p-nickname-${t.id}" placeholder="Nickname">
              <select class="select-field" id="p-cat-${t.id}">
                <option value="Heavyweight">Heavyweight</option>
                <option value="Lightweight">Lightweight</option>
              </select>
              <button type="submit" class="btn btn-primary">Join</button>
            </form>

            <!-- Player Entry List -->
            ${entries.length > 0 ? `
              <div class="table-wrapper">
                <table class="leaderboard">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Category</th>
                      <th class="admin-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${entries.map((entry, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td>
                          <strong>${escapeHtml(entry.name || '')}</strong>
                          ${entry.nickname ? `<span style="color:#64748b; font-size:0.85rem;"> (${escapeHtml(entry.nickname)})</span>` : ''}
                        </td>
                        <td><span class="badge" style="background:#020617;">${escapeHtml(entry.category || '')}</span></td>
                        <td class="admin-col">
                          <button class="btn btn-danger" onclick="removeParticipant('${entry.id}')">✕</button>
                        </td>
                      </tr>
                    `).join('')}
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
    loadTournaments();
  }
}

async function deleteTournament(id) {
  if (confirm("Are you sure you want to delete this tournament and all its entries?")) {
    const { error } = await supabaseClient
      .from('tournaments')
      .delete()
      .eq('id', id);

    if (!error) loadTournaments();
  }
}

// 4. Participant Actions
async function handleSignup(e, tournamentId) {
  e.preventDefault();
  const nameInput = document.getElementById(`p-name-${tournamentId}`);
  const nicknameInput = document.getElementById(`p-nickname-${tournamentId}`);
  const categoryInput = document.getElementById(`p-cat-${tournamentId}`);

  const name = nameInput.value.trim();
  const nickname = nicknameInput.value.trim();
  const category = categoryInput.value;

  if (!name) return;

  const { error } = await supabaseClient
    .from('registrations')
    .insert([{ tournament_id: tournamentId, name, nickname, category }]);

  if (error) {
    console.error("Error signing up:", error);
    alert("Failed to add entry: " + error.message);
  } else {
    nameInput.value = '';
    nicknameInput.value = '';
    loadTournaments();
  }
}

async function removeParticipant(entryId) {
  if (confirm("Remove participant?")) {
    const { error } = await supabaseClient
      .from('registrations')
      .delete()
      .eq('id', entryId);

    if (!error) loadTournaments();
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

// Ensure DOM is ready before loading tournaments
document.addEventListener('DOMContentLoaded', loadTournaments);
