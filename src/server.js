// Supabase Configuration
const SUPABASE_URL = "https://fetpncdjrmfknofvekqc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldHBuY2Rqcm1ma25vZnZla3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDE3NDEsImV4cCI6MjEwMjM3Nzc0MX0.oiKiVJ8u18g0G4XOmjcBaDGdezRwVuMqmVRI3e80V0E"; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let tournamentsData = [];
let availableProfiles = [];
let isAdmin = false;
let currentSessionUser = null;

// Initialize app data on load
document.addEventListener('DOMContentLoaded', async () => {
  await fetchProfiles();
  await loadTournaments();
});

// Helper to hash passwords securely using SHA-256 (Web Crypto API)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to sanitize HTML strings to prevent XSS
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

// Tab UI Toggle
function switchAuthTab(tab) {
  if (currentSessionUser) return;

  const signUpForm = document.getElementById('signup-form');
  const logInForm = document.getElementById('login-form');
  const signUpBtn = document.getElementById('tab-signup-btn');
  const logInBtn = document.getElementById('tab-login-btn');

  if (tab === 'signup') {
    if (signUpForm) signUpForm.style.display = 'block';
    if (logInForm) logInForm.style.display = 'none';
    if (signUpBtn) signUpBtn.className = 'btn btn-primary';
    if (logInBtn) logInBtn.className = 'btn btn-secondary';
  } else {
    if (signUpForm) signUpForm.style.display = 'none';
    if (logInForm) logInForm.style.display = 'block';
    if (signUpBtn) signUpBtn.className = 'btn btn-secondary';
    if (logInBtn) logInBtn.className = 'btn btn-primary';
  }
}

// 1. REGISTER PROFILE (With Password Hashing)
async function handleSignUp(event) {
  event.preventDefault();

  const playerName = document.getElementById('p-name')?.value.trim();
  const playerSurname = document.getElementById('p-surname')?.value.trim();
  const email = document.getElementById('p-email')?.value.trim();
  const password = document.getElementById('p-password')?.value;
  const gender = document.getElementById('p-gender')?.value;
  const dob = document.getElementById('p-dob')?.value;

  if (!email || !password) {
    alert("Please enter a valid email and password.");
    return;
  }

  // 1. Check if the email already exists in the database
  const { data: existingUser, error: checkError } = await supabaseClient
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking existing user:", checkError);
  }

  if (existingUser) {
    alert("A user with this email address is already registered.");
    return;
  }

  // 2. Hash password before sending to database
  const hashedPassword = await hashPassword(password);

  // 3. Insert new user profile
  const { data, error } = await supabaseClient
    .from('profiles')
    .insert([
      { 
        player_name: playerName + " " + playerSurname,
        email: email,
        password: hashedPassword,
        gender: gender, 
        dob: dob
      }
    ])
    .select();

  if (error) {
    if (error.code === '23505' || (error.message && error.message.includes('unique constraint'))) {
      alert("A user with this email address already exists.");
    } else {
      alert("Error saving profile: " + error.message);
    }
  } else {
    alert("Profile created successfully!");
    event.target.reset();
    setSessionUser(data[0]);
    togglePlayerProfilePanel();
    
    await fetchProfiles();
    renderTournaments();
  }
}

// 2. LOG IN (With Password Hashing)
async function handleLogIn(event) {
  event.preventDefault();

  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    alert("Please fill in both email and password.");
    return;
  }

  // Hash password to match database record
  const hashedPassword = await hashPassword(password);

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('email', email)
    .eq('password', hashedPassword)
    .maybeSingle();

  if (error || !data) {
    alert("Invalid email or password.");
  } else {
    alert(`Welcome back, ${data.player_name}!`);
    event.target.reset();
    setSessionUser(data);
    togglePlayerProfilePanel();
  }
}

// 3. LOGOUT & SESSION MANAGEMENT
function setSessionUser(user) {
  currentSessionUser = user;

  const statusDiv = document.getElementById('auth-user-status');
  const signUpForm = document.getElementById('signup-form');
  const logInForm = document.getElementById('login-form');
  const profileBtn = document.getElementById('player-profile-btn');
  const loggedInText = document.getElementById('logged-in-user-text');

  if (user) {
    if (statusDiv) statusDiv.style.display = 'block';
    if (signUpForm) signUpForm.style.display = 'none';
    if (logInForm) logInForm.style.display = 'none';
    
    if (loggedInText) loggedInText.innerText = `Logged in: ${user.player_name} (${user.email})`;
    if (profileBtn) profileBtn.innerHTML = `<span>👤</span> <span>${escapeHtml(user.player_name)}</span>`;
  } else {
    if (statusDiv) statusDiv.style.display = 'none';
    if (profileBtn) profileBtn.innerHTML = `<span>👤</span> <span>Sign Up / Log In</span>`;
    switchAuthTab('signup');
  }

  // Re-render tournaments view to update action buttons dynamically
  renderTournaments();
}

function handleLogOut() {
  currentSessionUser = null;
  setSessionUser(null);
  alert("Logged out.");
  togglePlayerProfilePanel();
}

// Fetch all profiles to populate dropdowns when needed
async function fetchProfiles() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, player_name, gender')
    .order('player_name', { ascending: true });

  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    availableProfiles = data || [];
  }
}

// Fetch Tournaments, Entries, and Joined Profiles
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
        partner_name,
        profiles (
          id,
          player_name,
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

// Clear date filter helper
function clearDateFilter() {
  const filterInput = document.getElementById('date-filter');
  if (filterInput) {
    filterInput.value = '';
    renderTournaments();
  }
}

// Render Tournaments & Dynamic Auth Controls
function renderTournaments() {
  const container = document.getElementById('tournaments-container');
  if (!container) return;

  const filterPeriod = document.getElementById('date-filter')?.value;

  const filteredData = tournamentsData.filter(t => {
    if (!t.event_date) return false;

    const now = new Date();
    const eventDate = new Date(t.event_date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const diffDays = Math.round((eventDay - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return false;

    if (filterPeriod === 'today') return diffDays === 0;
    if (filterPeriod === 'tomorrow') return diffDays === 1;
    if (filterPeriod === 'this_week') {
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
      ? `<p style="text-align:center; color:#64748b;">No upcoming tournaments found for this timeframe.</p>`
      : `<p style="text-align:center; color:#64748b;">No active tournaments scheduled.</p>`;
    return;
  }

  const categoriesOrder = ['Today', 'Tomorrow', 'Next Week', 'Later', 'Upcoming'];
  const groupedTournaments = {};

  filteredData.forEach(t => {
    const category = getDateCategory(t.event_date);
    if (!groupedTournaments[category]) groupedTournaments[category] = [];
    groupedTournaments[category].push(t);
  });

  let htmlContent = '';

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
        const targetGender = t.target_gender || 'All';
        const genderBadgeText = targetGender === 'All' ? 'Open' : `${targetGender} Only`;
        const isDoubles = t.is_doubles || false;

        // Determine session registration & gender eligibility
        const userRegistration = currentSessionUser 
          ? entries.find(e => e.profiles?.id === currentSessionUser.id)
          : null;

        const isGenderEligible = !currentSessionUser || targetGender === 'All' || currentSessionUser.gender === targetGender;

        // Dynamic Registration Action Bar
        let actionAreaHtml = '';
        if (!currentSessionUser) {
          actionAreaHtml = `
            <div style="margin-top: 1rem; text-align: center; background: #0f172a; padding: 10px; border-radius: 8px; border: 1px dashed var(--border);">
              <span style="font-size: 0.85rem; color: #94a3b8; margin-right: 8px;">Want to enter this event? Log In to Join</span>
            </div>
          `;
        } else if (userRegistration) {
          actionAreaHtml = `
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; background: #064e3b22; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--success);">
              <span style="color: var(--success); font-weight: 600; font-size: 0.85rem;">✓ You are registered for this tournament</span>
              <button class="btn btn-danger" onclick="removeParticipant('${userRegistration.id}')" style="padding: 4px 10px; font-size: 0.8rem;">Leave Event</button>
            </div>
          `;
        } else if (!isGenderEligible) {
          actionAreaHtml = `
            <div style="margin-top: 1rem; background: #450a0a22; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--danger); text-align: center;">
              <span style="color: var(--danger); font-size: 0.85rem;">This division is restricted to ${targetGender} players only.</span>
            </div>
          `;
        } else {
          actionAreaHtml = `
            <form onsubmit="handleSignup(event, '${t.id}', ${isDoubles})" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 8px;">
              ${isDoubles ? `
                <input type="text" id="partner-input-${t.id}" class="input-field" placeholder="Partner's Full Name (e.g. Enrique)" required />
              ` : ''}
              <button type="submit" class="btn btn-primary" style="width: 100%;">
                ${isDoubles ? 'Join Doubles Tournament' : `Join Tournament as ${escapeHtml(currentSessionUser.player_name)}`}
              </button>
            </form>
          `;
        }

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
              <span class="badge" style="background: var(--gold); color: #000;">${isDoubles ? '👥 Doubles' : '👤 Singles'}</span>
              <span class="badge" style="background: var(--gold); color: #000;">Division: ${escapeHtml(genderBadgeText)}</span>
              <span class="badge">Game: ${escapeHtml(t.game_type || '')}</span>
              <span class="badge">Format: ${escapeHtml(t.format || '')}</span>
              <span class="badge">${escapeHtml(t.race_to || '')}</span>
              <span class="badge">Entries: ${entries.length}</span>
            </div>

            ${actionAreaHtml}

            ${entries.length > 0 ? `
              <div class="table-wrapper">
                <table class="leaderboard">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>${isDoubles ? 'Pair' : 'Player'}</th>
                      <th class="admin-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${entries.map((entry, idx) => {
                      const profile = entry.profiles || {};
                      const isCurrentUser = currentSessionUser && profile.id === currentSessionUser.id;

                      const displayName = entry.partner_name 
                        ? `${escapeHtml(profile.player_name || 'Unknown')} & ${escapeHtml(entry.partner_name)}`
                        : escapeHtml(profile.player_name || 'Unknown');

                      return `
                        <tr style="${isCurrentUser ? 'background: rgba(56, 189, 248, 0.08);' : ''}">
                          <td>${idx + 1}</td>
                          <td>
                            <strong>${displayName}</strong>
                            ${isCurrentUser ? ' <span style="font-size: 0.75rem; color: var(--accent);">(You)</span>' : ''}
                          </td>
                          <td class="admin-col">
                            <button class="btn btn-danger" onclick="removeParticipant('${entry.id}', '${profile.id}')">✕</button>
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

// 4. Admin Actions
async function handleCreateTournament(event) {
  event.preventDefault();

  const rawDateValue = document.getElementById("t-date")?.value;
  if (!rawDateValue) {
    alert("Please select a date and time.");
    return;
  }

  const selectedDate = new Date(rawDateValue);
  const now = new Date();

  if (selectedDate < now) {
    alert("Tournament date cannot be in the past. Please select a future date and time.");
    return;
  }
  
  const name = document.getElementById('t-name')?.value.trim();
  const eventDate = selectedDate.toISOString();
  const gameType = document.getElementById('t-game')?.value;
  const raceNumber = parseInt(document.getElementById('t-race')?.value, 10);
  const format = document.getElementById('t-format')?.value;
  const targetGender = document.getElementById('t-target-gender')?.value;
  const isDoubles = document.getElementById('t-is-doubles')?.checked || false;
  const raceToText = `Race to ${raceNumber}`;

  const { data: createdTournament, error } = await supabaseClient
    .from('tournaments')
    .insert([
      { 
        name: name,
        event_date: eventDate, 
        game_type: gameType, 
        race_to: raceToText, 
        format: format,
        target_gender: targetGender,
        is_doubles: isDoubles
      }
    ])
    .select()
    .single();

  if (error) {
    alert('Error publishing tournament: ' + error.message);
    return;
  }

  alert("Tournament created successfully!");
  event.target.reset();
  await loadTournaments();
}

// 5. Participant Actions
async function handleSignup(e, tournamentId, isDoubles) {
  e.preventDefault();

  if (!currentSessionUser) {
    alert("You must be logged in to register for a tournament.");
    togglePlayerProfilePanel();
    return;
  }

  let partnerName = null;
  if (isDoubles) {
    const inputField = document.getElementById(`partner-input-${tournamentId}`);
    partnerName = inputField?.value.trim();

    if (!partnerName) {
      alert("Please enter your partner's name for doubles.");
      return;
    }
  }

  const { error } = await supabaseClient
    .from('registrations')
    .insert([{ 
      tournament_id: tournamentId, 
      profile_id: currentSessionUser.id,
      partner_name: partnerName
    }]);

  if (error) {
    console.error("Error signing up:", error);
    if (error.code === '23505' || (error.message && error.message.includes('unique constraint'))) {
      alert("You are already registered for this tournament.");
    } else {
      alert("Failed to join: " + error.message);
    }
  } else {
    await loadTournaments();
  }
}

async function removeParticipant(entryId, targetProfileId = null) {
  const isOwner = currentSessionUser && targetProfileId && currentSessionUser.id === targetProfileId;

  if (!isAdmin && !isOwner && targetProfileId !== null) {
    alert("You can only remove your own entry.");
    return;
  }

  if (confirm("Are you sure you want to cancel this registration?")) {
    const { error } = await supabaseClient
      .from('registrations')
      .delete()
      .eq('id', entryId);

    if (error) {
      alert("Failed to remove registration: " + error.message);
    } else {
      await loadTournaments();
    }
  }
}

// 6. Admin Authentication UI Toggle
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

function togglePlayerProfilePanel() {
  const panel = document.getElementById('player-panel');
  panel.classList.toggle('visible');
  
  // Always reset view to log in form when opening
  if (panel.classList.contains('visible')) {
    switchAuthTab('login');
  }
}
