// Supabase Configuration
const SUPABASE_URL = "https://fetpncdjrmfknofvekqc.supabase.co";[cite: 1]
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldHBuY2Rqcm1ma25vZnZla3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDE3NDEsImV4cCI6MjEwMjM3Nzc0MX0.oiKiVJ8u18g0G4XOmjcBaDGdezRwVuMqmVRI3e80V0E";[cite: 1]

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);[cite: 1]

let tournamentsData = [];[cite: 1]
let availableProfiles = [];[cite: 1]
let isAdmin = false;[cite: 1]
let currentSessionUser = null;[cite: 1]

// Paystack Public Key
const PAYSTACK_PUBLIC_KEY = "pk_test_17655c4677eb0a914b9bf7557869ac2749f81744";[cite: 1]

// Initialize app data on load
document.addEventListener('DOMContentLoaded', async () => {[cite: 1]
  await fetchProfiles();[cite: 1]
  await loadTournaments();[cite: 1]
});

// Helper to hash passwords securely using SHA-256 (Web Crypto API)
async function hashPassword(password) {[cite: 1]
  const encoder = new TextEncoder();[cite: 1]
  const data = encoder.encode(password);[cite: 1]
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);[cite: 1]
  const hashArray = Array.from(new Uint8Array(hashBuffer));[cite: 1]
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');[cite: 1]
}

// Helper to sanitize HTML strings to prevent XSS
function escapeHtml(str) {[cite: 1]
  if (!str) return '';[cite: 1]
  return String(str).replace(/[&<>"']/g, m => ({[cite: 1]
    '&': '&amp;',[cite: 1]
    '<': '&lt;',[cite: 1]
    '>': '&gt;',[cite: 1]
    '"': '&quot;',[cite: 1]
    "'": '&#39;'[cite: 1]
  }[m]));[cite: 1]
}

// Tab UI Toggle
function switchAuthTab(tab) {[cite: 1]
  if (currentSessionUser) return;[cite: 1]

  const signUpForm = document.getElementById('signup-form');[cite: 1]
  const logInForm = document.getElementById('login-form');[cite: 1]
  const signUpBtn = document.getElementById('tab-signup-btn');[cite: 1]
  const logInBtn = document.getElementById('tab-login-btn');[cite: 1]

  if (tab === 'signup') {[cite: 1]
    if (signUpForm) signUpForm.style.display = 'block';[cite: 1]
    if (logInForm) logInForm.style.display = 'none';[cite: 1]
    if (signUpBtn) signUpBtn.className = 'btn btn-primary';[cite: 1]
    if (logInBtn) logInBtn.className = 'btn btn-secondary';[cite: 1]
  } else {
    if (signUpForm) signUpForm.style.display = 'none';[cite: 1]
    if (logInForm) logInForm.style.display = 'block';[cite: 1]
    if (signUpBtn) signUpBtn.className = 'btn btn-secondary';[cite: 1]
    if (logInBtn) logInBtn.className = 'btn btn-primary';[cite: 1]
  }
}

// 1. REGISTER PROFILE
async function handleSignUp(event) {[cite: 1]
  event.preventDefault();[cite: 1]

  const playerName = document.getElementById('p-name')?.value.trim();[cite: 1]
  const playerSurname = document.getElementById('p-surname')?.value.trim();[cite: 1]
  const email = document.getElementById('p-email')?.value.trim();[cite: 1]
  const password = document.getElementById('p-password')?.value;[cite: 1]
  const gender = document.getElementById('p-gender')?.value;[cite: 1]
  const dob = document.getElementById('p-dob')?.value;[cite: 1]

  if (!email || !password) {[cite: 1]
    alert("Please enter a valid email and password.");[cite: 1]
    return;[cite: 1]
  }

  const { data: existingUser, error: checkError } = await supabaseClient[cite: 1]
    .from('profiles')[cite: 1]
    .select('id')[cite: 1]
    .ilike('email', email)[cite: 1]
    .maybeSingle();[cite: 1]

  if (checkError) {[cite: 1]
    console.error("Error checking existing user:", checkError);[cite: 1]
  }

  if (existingUser) {[cite: 1]
    alert("A user with this email address is already registered.");[cite: 1]
    return;[cite: 1]
  }

  const hashedPassword = await hashPassword(password);[cite: 1]

  const { data, error } = await supabaseClient[cite: 1]
    .from('profiles')[cite: 1]
    .insert([[cite: 1]
      { 
        player_name: playerName + " " + playerSurname,[cite: 1]
        email: email,[cite: 1]
        password: hashedPassword,[cite: 1]
        gender: gender, [cite: 1]
        dob: dob[cite: 1]
      }
    ])
    .select();[cite: 1]

  if (error) {[cite: 1]
    if (error.code === '23505' || (error.message && error.message.includes('unique constraint'))) {[cite: 1]
      alert("A user with this email address already exists.");[cite: 1]
    } else {
      alert("Error saving profile: " + error.message);[cite: 1]
    }
  } else {
    alert("Profile created successfully!");[cite: 1]
    event.target.reset();[cite: 1]
    setSessionUser(data[0]);[cite: 1]
    togglePlayerProfilePanel();[cite: 1]
    
    await fetchProfiles();[cite: 1]
    renderTournaments();[cite: 1]
  }
}

// 2. LOG IN
async function handleLogIn(event) {[cite: 1]
  event.preventDefault();[cite: 1]

  const email = document.getElementById('login-email')?.value.trim();[cite: 1]
  const password = document.getElementById('login-password')?.value;[cite: 1]

  if (!email || !password) {[cite: 1]
    alert("Please fill in both email and password.");[cite: 1]
    return;[cite: 1]
  }

  const hashedPassword = await hashPassword(password);[cite: 1]

  const { data, error } = await supabaseClient[cite: 1]
    .from('profiles')[cite: 1]
    .select('*')[cite: 1]
    .eq('email', email)[cite: 1]
    .eq('password', hashedPassword)[cite: 1]
    .maybeSingle();[cite: 1]

  if (error || !data) {[cite: 1]
    alert("Invalid email or password.");[cite: 1]
  } else {
    event.target.reset();[cite: 1]
    setSessionUser(data);[cite: 1]
    togglePlayerProfilePanel();[cite: 1]
  }
}

// 3. LOGOUT & SESSION MANAGEMENT
function setSessionUser(user) {[cite: 1]
  currentSessionUser = user;[cite: 1]

  const statusDiv = document.getElementById('auth-user-status');[cite: 1]
  const signUpForm = document.getElementById('signup-form');[cite: 1]
  const logInForm = document.getElementById('login-form');[cite: 1]
  const profileBtn = document.getElementById('player-profile-btn');[cite: 1]
  const loggedInText = document.getElementById('logged-in-user-text');[cite: 1]

  if (user) {[cite: 1]
    if (statusDiv) statusDiv.style.display = 'block';[cite: 1]
    if (signUpForm) signUpForm.style.display = 'none';[cite: 1]
    if (logInForm) logInForm.style.display = 'none';[cite: 1]
    
    if (loggedInText) loggedInText.innerText = `Logged in: ${user.player_name} (${user.email})`;[cite: 1]
    if (profileBtn) profileBtn.innerHTML = `<span>👤</span> <span>${escapeHtml(user.player_name)}</span>`;[cite: 1]
  } else {
    if (statusDiv) statusDiv.style.display = 'none';[cite: 1]
    if (signUpForm) signUpForm.style.display = 'none';[cite: 1]
    if (logInForm) logInForm.style.display = 'none';[cite: 1]
    if (profileBtn) profileBtn.innerHTML = `<span>👤</span> <span>Sign Up / Log In</span>`;[cite: 1]
    switchAuthTab('signup');[cite: 1]
  }

  updateWalletUI();
  renderTournaments();[cite: 1]
}

function handleLogOut() {[cite: 1]
  currentSessionUser = null;[cite: 1]
  setSessionUser(null);[cite: 1]
  togglePlayerProfilePanel();[cite: 1]
}

async function fetchProfiles() {[cite: 1]
  const { data, error } = await supabaseClient[cite: 1]
    .from('profiles')[cite: 1]
    .select('id, player_name, gender')[cite: 1]
    .order('player_name', { ascending: true });[cite: 1]

  if (error) {[cite: 1]
    console.error("Error fetching profiles:", error);[cite: 1]
  } else {
    availableProfiles = data || [];[cite: 1]
  }
}

async function loadTournaments() {[cite: 1]
  const container = document.getElementById('tournaments-container');[cite: 1]
  if (!container) return;[cite: 1]

  const { data, error } = await supabaseClient[cite: 1]
    .from('tournaments')[cite: 1]
    .select(`
      *,
      registrations (
        id,
        created_at,
        partner_name,
        payment_method,
        payment_status,
        profiles (
          id,
          player_name,
          gender
        )
      )
    `)
    .order('event_date', { ascending: true });[cite: 1]

  if (error) {[cite: 1]
    console.error("Error fetching tournaments:", error);[cite: 1]
    container.innerHTML = `<p style="text-align:center; color:var(--danger);">Failed to load tournaments.</p>`;[cite: 1]
    return;[cite: 1]
  }

  tournamentsData = data || [];[cite: 1]
  renderTournaments();[cite: 1]
}

function formatTournamentDate(isoString) {[cite: 1]
  if (!isoString) return 'Date TBD';[cite: 1]
  const date = new Date(isoString);[cite: 1]
  return new Intl.DateTimeFormat('en-US', {[cite: 1]
    weekday: 'short',[cite: 1]
    day: 'numeric',[cite: 1]
    month: 'short',[cite: 1]
    hour: 'numeric',[cite: 1]
    minute: '2-digit',[cite: 1]
    hour12: true[cite: 1]
  }).format(date); [cite: 1]
}

function getDateCategory(isoString) {[cite: 1]
  if (!isoString) return 'Upcoming';[cite: 1]
  
  const now = new Date();[cite: 1]
  const eventDate = new Date(isoString);[cite: 1]

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());[cite: 1]
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());[cite: 1]

  const diffTime = eventDay - today;[cite: 1]
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));[cite: 1]

  if (diffDays < 0) return 'Past Events';[cite: 1]
  if (diffDays === 0) return 'Today';[cite: 1]
  if (diffDays === 1) return 'Tomorrow';[cite: 1]
  if (diffDays > 1 && diffDays <= 7) return 'This Week';[cite: 1]
  if (diffDays > 7 && diffDays <= 14) return 'Next Week';[cite: 1]
  return 'Later';[cite: 1]
}

function clearDateFilter() {[cite: 1]
  const filterInput = document.getElementById('date-filter');[cite: 1]
  if (filterInput) {[cite: 1]
    filterInput.value = '';[cite: 1]
    renderTournaments();[cite: 1]
  }
}

function renderTournaments() {[cite: 1]
  const container = document.getElementById('tournaments-container');[cite: 1]
  if (!container) return;[cite: 1]

  const filterPeriod = document.getElementById('date-filter')?.value;[cite: 1]

  const filteredData = tournamentsData.filter(t => {[cite: 1]
    if (!t.event_date) return false;[cite: 1]

    const now = new Date();[cite: 1]
    const eventDate = new Date(t.event_date);[cite: 1]
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());[cite: 1]
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());[cite: 1]
    const diffDays = Math.round((eventDay - today) / (1000 * 60 * 60 * 24));[cite: 1]

    if (diffDays < 0) return false;[cite: 1]

    if (filterPeriod === 'today') return diffDays === 0;[cite: 1]
    if (filterPeriod === 'tomorrow') return diffDays === 1;[cite: 1]
    if (filterPeriod === 'this_week') {[cite: 1]
      const daysUntilEndOfWeek = 6 - today.getDay();[cite: 1]
      return diffDays >= 0 && diffDays <= daysUntilEndOfWeek;[cite: 1]
    }
    if (filterPeriod === 'this_month') {[cite: 1]
      return ([cite: 1]
        eventDay >= today &&[cite: 1]
        eventDate.getMonth() === now.getMonth() &&[cite: 1]
        eventDate.getFullYear() === now.getFullYear()[cite: 1]
      );
    }
    return true;[cite: 1]
  });

  if (filteredData.length === 0) {[cite: 1]
    container.innerHTML = filterPeriod [cite: 1]
      ? `<p style="text-align:center; color:#64748b;">No upcoming tournaments found for this timeframe.</p>`[cite: 1]
      : `<p style="text-align:center; color:#64748b;">No active tournaments scheduled.</p>`;[cite: 1]
    return;[cite: 1]
  }

  const categoriesOrder = ['Today', 'Tomorrow', 'Next Week', 'Later', 'Upcoming'];[cite: 1]
  const groupedTournaments = {};[cite: 1]

  filteredData.forEach(t => {[cite: 1]
    const category = getDateCategory(t.event_date);[cite: 1]
    if (!groupedTournaments[category]) groupedTournaments[category] = [];[cite: 1]
    groupedTournaments[category].push(t);[cite: 1]
  });

  let htmlContent = '';[cite: 1]

  categoriesOrder.forEach(category => {[cite: 1]
    if (groupedTournaments[category] && groupedTournaments[category].length > 0) {[cite: 1]
      htmlContent += `
        <div style="margin: 1.5rem 0 0.75rem 0; padding-bottom: 4px; border-bottom: 1px solid var(--border);">
          <h3 style="color: var(--gold); margin: 0; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.5px;">
            📌 ${category}
          </h3>
        </div>
      `;[cite: 1]

      htmlContent += groupedTournaments[category].map(t => {[cite: 1]
        const entries = t.registrations || [];[cite: 1]
        const formattedDate = formatTournamentDate(t.event_date);[cite: 1]
        const tournamentName = t.name ? escapeHtml(t.name) : escapeHtml((t.game_type || '').toUpperCase());[cite: 1]
        const targetGender = t.target_gender || 'All';[cite: 1]
        const genderBadgeText = targetGender === 'All' ? 'Open' : `${targetGender} Only`;[cite: 1]
        const isDoubles = t.is_doubles || false;[cite: 1]
        const entryFee = t.entry_fee || 0;[cite: 1]
        const entryFeeText = (entryFee > 0) ? `R${entryFee}` : 'FREE ENTRY';[cite: 1]

        const userRegistration = currentSessionUser [cite: 1]
          ? entries.find(e => e.profiles?.id === currentSessionUser.id)[cite: 1]
          : null;[cite: 1]

        const isGenderEligible = !currentSessionUser || targetGender === 'All' || currentSessionUser.gender === targetGender;[cite: 1]
        const userWalletBalance = parseFloat(currentSessionUser?.wallet_balance || 0);[cite: 1]

        let actionAreaHtml = '';[cite: 1]
        if (!currentSessionUser) {[cite: 1]
          actionAreaHtml = `
            <div style="margin-top: 1rem; text-align: center; background: #0f172a; padding: 10px; border-radius: 8px; border: 1px dashed var(--border);">
              <span style="font-size: 0.85rem; color: #94a3b8; margin-right: 8px;">Want to enter this event? Log In to Join</span>
            </div>
          `;[cite: 1]
        } else if (userRegistration) {[cite: 1]
          actionAreaHtml = `
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; background: #064e3b22; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--success);">
              <span style="color: var(--success); font-weight: 600; font-size: 0.85rem;">✓ You are registered for this tournament</span>
              <button class="btn btn-danger" onclick="removeParticipant('${userRegistration.id}')" style="padding: 4px 10px; font-size: 0.8rem;">Leave Event</button>
            </div>
          `;[cite: 1]
        } else if (!isGenderEligible) {[cite: 1]
          actionAreaHtml = `
            <div style="margin-top: 1rem; background: #450a0a22; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--danger); text-align: center;">
              <span style="color: var(--danger); font-size: 0.85rem;">This division is restricted to ${targetGender} players only.</span>
            </div>
          `;[cite: 1]
        } else {
          actionAreaHtml = `
            <form onsubmit="handleSignup(event, '${t.id}', ${isDoubles})" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 8px;">
              ${isDoubles ? `
                <input type="text" id="partner-input-${t.id}" class="input-field" placeholder="Partner's Full Name (e.g. Enrique)" required />
              ` : ''}
              
              ${entryFee > 0 ? `
                <select id="payment-method-${t.id}" class="select-field" required>
                  <option value="wallet">Pay with Wallet (Balance: R${userWalletBalance.toFixed(2)})</option>
                  <option value="cash">Pay Cash at Venue</option>
                </select>
              ` : ''}

              <button type="submit" class="btn btn-primary" style="width: 100%;">
                ${isDoubles ? 'Join Doubles Tournament' : `Join Tournament as ${escapeHtml(currentSessionUser.player_name)}`}
              </button>
            </form>
          `;[cite: 1]
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
              <span class="badge" style="background: #22c55e; color: #000; font-weight: bold;">💵 Entry Fee: ${entryFeeText}</span>
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
                      <th>Payment</th>
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

                      const method = (entry.payment_method || 'EFT').toUpperCase();
                      const badgeBg = method === 'CASH' ? '#eab308' : method === 'WALLET' ? '#a855f7' : method === 'FREE' ? '#64748b' : '#22c55e';

                      return `
                        <tr style="${isCurrentUser ? 'background: rgba(56, 189, 248, 0.08);' : ''}">
                          <td>${idx + 1}</td>
                          <td>
                            <strong>${displayName}</strong>
                            ${isCurrentUser ? ' <span style="font-size: 0.75rem; color: var(--accent);">(You)</span>' : ''}
                          </td>
                          <td>
                            <span class="badge" style="background: ${badgeBg}; color: #000; font-weight: bold;">
                              ${method}
                            </span>
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
        `;[cite: 1]
      }).join('');[cite: 1]
    }
  });

  container.innerHTML = htmlContent;[cite: 1]
}

// 4. Admin Actions
async function handleCreateTournament(event) {[cite: 1]
  event.preventDefault();[cite: 1]

  const rawDateValue = document.getElementById("t-date")?.value;[cite: 1]
  if (!rawDateValue) {[cite: 1]
    alert("Please select a date and time.");[cite: 1]
    return;[cite: 1]
  }

  const selectedDate = new Date(rawDateValue);[cite: 1]
  const now = new Date();[cite: 1]

  if (selectedDate < now) {[cite: 1]
    alert("Tournament date cannot be in the past. Please select a future date and time.");[cite: 1]
    return;[cite: 1]
  }
  
  const name = document.getElementById('t-name')?.value.trim();[cite: 1]
  const eventDate = selectedDate.toISOString();[cite: 1]
  const gameType = document.getElementById('t-game')?.value;[cite: 1]
  const raceNumber = parseInt(document.getElementById('t-race')?.value, 10);[cite: 1]
  const format = document.getElementById('t-format')?.value;[cite: 1]
  const targetGender = document.getElementById('t-target-gender')?.value;[cite: 1]
  const isDoubles = document.getElementById('t-is-doubles')?.checked || false;[cite: 1]
  
  const entryFeeInput = document.getElementById('t-entry')?.value;[cite: 1]
  const entryFee = entryFeeInput ? parseFloat(entryFeeInput) : 0;[cite: 1]

  const raceToText = `Race to ${raceNumber}`;[cite: 1]

  const { data: createdTournament, error } = await supabaseClient[cite: 1]
    .from('tournaments')[cite: 1]
    .insert([[cite: 1]
      { 
        name: name,[cite: 1]
        event_date: eventDate,  [cite: 1]
        game_type: gameType, [cite: 1]
        race_to: raceToText, [cite: 1]
        format: format,[cite: 1]
        target_gender: targetGender,[cite: 1]
        is_doubles: isDoubles,[cite: 1]
        entry_fee: entryFee[cite: 1]
      }
    ])
    .select()[cite: 1]
    .single();[cite: 1]

  if (error) {[cite: 1]
    alert('Error publishing tournament: ' + error.message);[cite: 1]
    return;[cite: 1]
  }
  event.target.reset();[cite: 1]
  await loadTournaments();[cite: 1]
}

// 5. Participant Actions
async function handleSignup(e, tournamentId, isDoubles) {[cite: 1]
  e.preventDefault();[cite: 1]

  if (!currentSessionUser) return alert("Log in to enter.");[cite: 1]
  const tournament = tournamentsData.find(t => t.id === tournamentId);[cite: 1]
  const entryFee = tournament ? (tournament.entry_fee || 0) : 0;[cite: 1]
  
  let partnerName = isDoubles ? document.getElementById(`partner-input-${tournamentId}`)?.value.trim() : null;[cite: 1]
  const paymentMethod = entryFee > 0 ? document.getElementById(`payment-method-${tournamentId}`)?.value : 'free';[cite: 1]

  // Free entry
  if (entryFee <= 0 || paymentMethod === 'free') {[cite: 1]
    return completeRegistration({ [cite: 1]
      tournamentId, [cite: 1]
      profileId: currentSessionUser.id, [cite: 1]
      partnerName,  [cite: 1]
      paymentStatus: 'free', [cite: 1]
      paymentMethod: 'free' [cite: 1]
    });
  }

  // Virtual Wallet
  if (paymentMethod === 'wallet') {[cite: 1]
    const { data: profile } = await supabaseClient[cite: 1]
      .from('profiles')[cite: 1]
      .select('wallet_balance')[cite: 1]
      .eq('id', currentSessionUser.id)[cite: 1]
      .single();[cite: 1]

    const balance = parseFloat(profile?.wallet_balance || 0);[cite: 1]

    if (balance < entryFee) {[cite: 1]
      return alert(`Insufficient wallet balance (R${balance.toFixed(2)}). Please deposit funds into your wallet using Paystack or choose Cash at venue.`);[cite: 1]
    }

    const newBalance = balance - entryFee;[cite: 1]
    
    await supabaseClient[cite: 1]
      .from('profiles')[cite: 1]
      .update({ wallet_balance: newBalance })[cite: 1]
      .eq('id', currentSessionUser.id);[cite: 1]

    await supabaseClient.from('wallet_transactions').insert([{[cite: 1]
      profile_id: currentSessionUser.id,[cite: 1]
      type: 'tournament_entry',[cite: 1]
      amount: entryFee,[cite: 1]
      reference: `ENTRY-${tournamentId}`[cite: 1]
    }]);

    currentSessionUser.wallet_balance = newBalance;[cite: 1]
    updateWalletUI();[cite: 1]

    return completeRegistration({ [cite: 1]
      tournamentId, [cite: 1]
      profileId: currentSessionUser.id, [cite: 1]
      partnerName, [cite: 1]
      paymentStatus: 'paid', [cite: 1]
      paymentMethod: 'wallet', [cite: 1]
      amount: entryFee [cite: 1]
    });
  }

  // Cash Option
  if (paymentMethod === 'cash') {[cite: 1]
    return completeRegistration({ [cite: 1]
      tournamentId, [cite: 1]
      profileId: currentSessionUser.id, [cite: 1]
      partnerName, [cite: 1]
      paymentStatus: 'pending_cash',  [cite: 1]
      paymentMethod: 'cash', [cite: 1]
      amount: entryFee [cite: 1]
    });
  }
}

// Complete Database Insertion
async function completeRegistration({ tournamentId, profileId, partnerName, paymentStatus, paymentMethod, reference, amount = 0 }) {[cite: 1]
  const { error } = await supabaseClient[cite: 1]
    .from('registrations')[cite: 1]
    .insert([{ [cite: 1]
      tournament_id: tournamentId, [cite: 1]
      profile_id: profileId,[cite: 1]
      partner_name: partnerName,[cite: 1]
      payment_status: paymentStatus,[cite: 1]
      payment_method: paymentMethod,
      payment_reference: reference || null,[cite: 1]
      paid_amount: amount[cite: 1]
    }]);

  if (error) {[cite: 1]
    console.error("Error signing up:", error);[cite: 1]
    if (error.code === '23505' || (error.message && error.message.includes('unique constraint'))) {[cite: 1]
      alert("You are already registered for this tournament.");[cite: 1]
    } else {
      alert("Failed to complete registration: " + error.message);[cite: 1]
    }
  } else {
    await loadTournaments();[cite: 1]
  }
}

// CANCELLATION & REFUND LOGGING
async function removeParticipant(entryId, targetProfileId = null) {[cite: 1]
  const isOwner = currentSessionUser && targetProfileId && currentSessionUser.id === targetProfileId;[cite: 1]

  if (!isAdmin && !isOwner && targetProfileId !== null) {[cite: 1]
    alert("You can only remove your own entry.");[cite: 1]
    return;[cite: 1]
  }

  if (!confirm("Are you sure you want to cancel this registration?")) return;[cite: 1]

  const { data: registrationData, error: fetchErr } = await supabaseClient[cite: 1]
    .from('registrations')[cite: 1]
    .select(`
      id,
      payment_status,
      payment_reference,
      paid_amount,
      profiles (
        player_name,
        email
      ),
      tournaments (
        name,
        game_type
      )
    `)
    .eq('id', entryId)[cite: 1]
    .maybeSingle();[cite: 1]

  if (fetchErr || !registrationData) {[cite: 1]
    alert("Could not fetch registration details.");[cite: 1]
    return;[cite: 1]
  }

  const isPaid = registrationData.payment_status === 'paid' && registrationData.paid_amount > 0;[cite: 1]

  if (isPaid) {[cite: 1]
    const tournamentTitle = registrationData.tournaments?.name || registrationData.tournaments?.game_type || 'Unknown Event';[cite: 1]
    const playerName = registrationData.profiles?.player_name || currentSessionUser?.player_name || 'Unknown';[cite: 1]
    const playerEmail = registrationData.profiles?.email || currentSessionUser?.email || 'N/A';[cite: 1]

    const { error: refundLogErr } = await supabaseClient[cite: 1]
      .from('refund_requests')[cite: 1]
      .insert([{[cite: 1]
        registration_id: entryId,[cite: 1]
        tournament_name: tournamentTitle,[cite: 1]
        player_name: playerName,[cite: 1]
        player_email: playerEmail,[cite: 1]
        payment_reference: registrationData.payment_reference || 'N/A',[cite: 1]
        amount: registrationData.paid_amount,[cite: 1]
        status: 'pending'[cite: 1]
      }]);

    if (refundLogErr) {[cite: 1]
      alert("Failed to record refund request: " + refundLogErr.message);[cite: 1]
      return;[cite: 1]
    }
  }

  const { error: deleteError } = await supabaseClient[cite: 1]
    .from('registrations')[cite: 1]
    .delete()[cite: 1]
    .eq('id', entryId);[cite: 1]

  if (deleteError) {[cite: 1]
    alert("Failed to remove registration: " + deleteError.message);[cite: 1]
  } else {
    alert("Registration canceled successfully." + (isPaid ? " Your refund request has been logged for admin payout." : ""));[cite: 1]
    if (typeof loadTournaments === 'function') await loadTournaments();[cite: 1]
    if (isAdmin && typeof loadRefundRequests === 'function') await loadRefundRequests();[cite: 1]
  }
}

// ADMIN REFUND MANAGEMENT
async function loadRefundRequests() {[cite: 1]
  const container = document.getElementById('admin-refunds-container');[cite: 1]
  if (!container) return;[cite: 1]

  container.innerHTML = `<p style="color: #94a3b8; font-size: 0.85rem;">Loading refund requests...</p>`;[cite: 1]

  const { data: requests, error } = await supabaseClient[cite: 1]
    .from('refund_requests')[cite: 1]
    .select('*')[cite: 1]
    .eq('status', 'pending')[cite: 1]
    .order('created_at', { ascending: false });[cite: 1]

  if (error) {[cite: 1]
    container.innerHTML = `<p style="color: var(--danger); font-size: 0.85rem;">Error loading refunds: ${error.message}</p>`;[cite: 1]
    return;[cite: 1]
  }

  if (!requests || requests.length === 0) {[cite: 1]
    container.innerHTML = `<p style="color: #64748b; font-size: 0.85rem;">No unpaid refund requests found.</p>`;[cite: 1]
    return;[cite: 1]
  }

  let html = `
    <div class="table-wrapper">
      <table class="leaderboard" style="font-size: 0.85rem;">
        <thead>
          <tr>
            <th>Player</th>
            <th>Tournament</th>
            <th>Amount</th>
            <th>Status</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
  `;[cite: 1]

  requests.forEach(req => {[cite: 1]
    const statusBadge = `<span class="badge" style="background:#854d0e; color:#fef08a;">Pending</span>`;[cite: 1]

    html += `
      <tr>
        <td>
          <strong>${escapeHtml(req.player_name)}</strong><br>
          <small style="color: #64748b;">${escapeHtml(req.player_email)}</small>
        </td>
        <td>${escapeHtml(req.tournament_name)}</td>

        <td style="color: var(--gold); font-weight: bold;">R${parseFloat(req.amount).toFixed(2)}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right;">
          <button 
            class="btn btn-primary" 
            style="padding: 3px 8px; font-size: 0.75rem; background: var(--success);"
            onclick="updateRefundStatus('${req.id}', 'completed')">
            ✓ Paid
          </button>
        </td>
      </tr>
    `;[cite: 1]
  });

  html += `</tbody></table></div>`;[cite: 1]
  container.innerHTML = html;[cite: 1]
}

async function updateRefundStatus(refundId, newStatus) {[cite: 1]
  const actionText = newStatus === 'completed' ? 'mark as PROCESSED / PAID' : 'REJECT';[cite: 1]
  if (!confirm(`Are you sure you want to ${actionText} this refund request?`)) return;[cite: 1]

  const { error } = await supabaseClient[cite: 1]
    .from('refund_requests')[cite: 1]
    .update({ status: newStatus })[cite: 1]
    .eq('id', refundId);[cite: 1]

  if (error) {[cite: 1]
    alert("Failed to update status: " + error.message);[cite: 1]
  } else {
    await loadRefundRequests();[cite: 1]
  }
}

// 6. Admin Authentication UI Toggle
function toggleAdminPrompt() {[cite: 1]
  if (isAdmin) { [cite: 1]
    logoutAdmin(); [cite: 1]
    return; [cite: 1]
  }
  
  const inputPass = prompt("Admin Password:");[cite: 1]
  if (inputPass) {[cite: 1]
    isAdmin = true;[cite: 1]
    document.getElementById('app-body')?.classList.add('admin-mode-active');[cite: 1]
    document.getElementById('admin-panel')?.classList.add('visible');[cite: 1]
    const label = document.getElementById('admin-btn-label');[cite: 1]
    if (label) label.innerText = 'Exit Edit Mode';[cite: 1]
    renderTournaments();[cite: 1]
    loadRefundRequests();[cite: 1]
  }
}

function logoutAdmin() {[cite: 1]
  isAdmin = false;[cite: 1]
  document.getElementById('app-body')?.classList.remove('admin-mode-active');[cite: 1]
  document.getElementById('admin-panel')?.classList.remove('visible');[cite: 1]
  const label = document.getElementById('admin-btn-label');[cite: 1]
  if (label) label.innerText = 'Admin Login';[cite: 1]
  renderTournaments();[cite: 1]
}

function togglePlayerProfilePanel() {[cite: 1]
  const panel = document.getElementById('player-panel');[cite: 1]
  if (panel) {[cite: 1]
    panel.classList.toggle('visible');[cite: 1]
  }
}

async function deleteTournament(tournamentId) {[cite: 1]
  if (!isAdmin) {[cite: 1]
    alert("Unauthorized action. Admin rights required.");[cite: 1]
    return;[cite: 1]
  }

  const tournament = tournamentsData.find(t => t.id === tournamentId);[cite: 1]
  const tournamentName = tournament ? (tournament.name || tournament.game_type || "Unknown Event") : "this tournament";[cite: 1]

  if (!confirm(`Are you sure you want to delete "${tournamentName}"? This will cancel all registrations and log refund requests for paid entries.`)) {[cite: 1]
    return;[cite: 1]
  }

  const { data: registrations, error: fetchErr } = await supabaseClient[cite: 1]
    .from('registrations')[cite: 1]
    .select(`
      id,
      payment_status,
      payment_reference,
      paid_amount,
      profiles (
        player_name,
        email
      )
    `)
    .eq('tournament_id', tournamentId);[cite: 1]

  if (fetchErr) {[cite: 1]
    console.error("Error fetching registrations for deletion:", fetchErr);[cite: 1]
    alert("Failed to retrieve tournament registrations: " + fetchErr.message);[cite: 1]
    return;[cite: 1]
  }

  const paidRegistrations = (registrations || []).filter([cite: 1]
    r => r.payment_status === 'paid' && r.paid_amount > 0[cite: 1]
  );

  if (paidRegistrations.length > 0) {[cite: 1]
    const refundRows = paidRegistrations.map(r => ({[cite: 1]
      registration_id: r.id,[cite: 1]
      tournament_name: tournamentName,[cite: 1]
      player_name: r.profiles?.player_name || 'Unknown',[cite: 1]
      player_email: r.profiles?.email || 'N/A',[cite: 1]
      payment_reference: r.payment_reference || 'N/A',[cite: 1]
      amount: r.paid_amount,[cite: 1]
      status: 'pending'[cite: 1]
    }));

    const { error: refundErr } = await supabaseClient[cite: 1]
      .from('refund_requests')[cite: 1]
      .insert(refundRows);[cite: 1]

    if (refundErr) {[cite: 1]
      console.error("Error logging refund requests:", refundErr);[cite: 1]
      alert("Failed to record refund requests: " + refundErr.message);[cite: 1]
      return;[cite: 1]
    }
  }

  const { error: regDeleteError } = await supabaseClient[cite: 1]
    .from('registrations')[cite: 1]
    .delete()[cite: 1]
    .eq('tournament_id', tournamentId);[cite: 1]

  if (regDeleteError) {[cite: 1]
    console.error("Error deleting registrations:", regDeleteError);[cite: 1]
    alert("Failed to clear registrations: " + regDeleteError.message);[cite: 1]
    return;[cite: 1]
  }

  const { error: tournamentDeleteError } = await supabaseClient[cite: 1]
    .from('tournaments')[cite: 1]
    .delete()[cite: 1]
    .eq('id', tournamentId);[cite: 1]

  if (tournamentDeleteError) {[cite: 1]
    console.error("Error deleting tournament:", tournamentDeleteError);[cite: 1]
    alert("Failed to delete tournament: " + tournamentDeleteError.message);[cite: 1]
  } else {
    const refundMessage = paidRegistrations.length > 0[cite: 1]
      ? ` ${paidRegistrations.length} refund request(s) logged for admin payout.`[cite: 1]
      : '';[cite: 1]
    alert(`Tournament deleted successfully!${refundMessage}`);[cite: 1]
    
    await loadTournaments();[cite: 1]
    if (typeof loadRefundRequests === 'function') {[cite: 1]
      await loadRefundRequests();[cite: 1]
    }
  }
}

async function loadUserProfile(userId) {[cite: 1]
  const { data: profile, error } = await supabaseClient[cite: 1]
    .from('profiles')[cite: 1]
    .select('notifications_enabled')[cite: 1]
    .eq('id', userId)[cite: 1]
    .single();[cite: 1]

  if (error) {[cite: 1]
    console.error('Error fetching profile settings:', error.message);[cite: 1]
    return;[cite: 1]
  }

  const notifCheckbox = document.getElementById('p-notifications');[cite: 1]
  if (notifCheckbox && profile) {[cite: 1]
    notifCheckbox.checked = profile.notifications_enabled || false;[cite: 1]
  }
}

async function handleToggleNotifications(isEnabled) {[cite: 1]
  const user = supabaseClient.auth.getUser();[cite: 1]
  const { data: { session } } = await supabaseClient.auth.getSession();[cite: 1]

  if (!session?.user) {[cite: 1]
    alert("You must be logged in to change notification settings.");[cite: 1]
    return;[cite: 1]
  }

  const { error } = await supabaseClient[cite: 1]
    .from('profiles')[cite: 1]
    .update({ notifications_enabled: isEnabled })[cite: 1]
    .eq('id', session.user.id);[cite: 1]

  if (error) {[cite: 1]
    alert('Failed to update notification settings: ' + error.message);[cite: 1]
    document.getElementById('p-notifications').checked = !isEnabled;[cite: 1]
  }
}

// Deposit funds into Virtual Wallet via Paystack
async function handleWalletDeposit() {[cite: 1]
  if (!currentSessionUser) return alert("Please log in first.");[cite: 1]
  
  const amountStr = prompt("Enter amount to deposit (ZAR):");[cite: 1]
  const amount = parseFloat(amountStr);[cite: 1]
  if (isNaN(amount) || amount <= 0) return alert("Invalid deposit amount.");[cite: 1]

  const reference = `DEP-${currentSessionUser.id.substring(0, 5)}-${Date.now()}`;[cite: 1]

  const handler = PaystackPop.setup({[cite: 1]
    key: PAYSTACK_PUBLIC_KEY,[cite: 1]
    email: currentSessionUser.email,[cite: 1]
    amount: Math.round(amount * 100),[cite: 1]
    currency: 'ZAR',[cite: 1]
    ref: reference,[cite: 1]
    callback: async function(response) {[cite: 1]
      const { data: profile } = await supabaseClient[cite: 1]
        .from('profiles')[cite: 1]
        .select('wallet_balance')[cite: 1]
        .eq('id', currentSessionUser.id)[cite: 1]
        .single();[cite: 1]

      const newBalance = (parseFloat(profile?.wallet_balance || 0) + amount);[cite: 1]

      await supabaseClient[cite: 1]
        .from('profiles')[cite: 1]
        .update({ wallet_balance: newBalance })[cite: 1]
        .eq('id', currentSessionUser.id);[cite: 1]

      await supabaseClient.from('wallet_transactions').insert([{[cite: 1]
        profile_id: currentSessionUser.id,[cite: 1]
        type: 'deposit',[cite: 1]
        amount: amount,[cite: 1]
        reference: response.reference[cite: 1]
      }]);

      currentSessionUser.wallet_balance = newBalance;[cite: 1]
      updateWalletUI();[cite: 1]
      alert(`Successfully deposited R${amount.toFixed(2)} into your wallet!`);[cite: 1]
    }
  });
  handler.openIframe();[cite: 1]
}

// Withdraw funds directly to bank account
async function handleWalletWithdraw() {[cite: 1]
  if (!currentSessionUser) return alert("Please log in first.");[cite: 1]

  const { data: profile } = await supabaseClient[cite: 1]
    .from('profiles')[cite: 1]
    .select('wallet_balance')[cite: 1]
    .eq('id', currentSessionUser.id)[cite: 1]
    .single();[cite: 1]

  const currentBalance = parseFloat(profile?.wallet_balance || 0);[cite: 1]
  const amountStr = prompt(`Current Balance: R${currentBalance.toFixed(2)}\nEnter amount to withdraw to bank account:`);[cite: 1]
  const amount = parseFloat(amountStr);[cite: 1]

  if (isNaN(amount) || amount <= 0) return alert("Invalid amount.");[cite: 1]
  if (amount > currentBalance) return alert("Insufficient wallet funds.");[cite: 1]

  const bankAccount = prompt("Enter your Bank Account Number & Bank Name:");[cite: 1]
  if (!bankAccount) return alert("Bank account details required for withdrawal.");[cite: 1]

  const newBalance = currentBalance - amount;[cite: 1]

  await supabaseClient.from('profiles').update({ wallet_balance: newBalance }).eq('id', currentSessionUser.id);[cite: 1]
  await supabaseClient.from('wallet_transactions').insert([{[cite: 1]
    profile_id: currentSessionUser.id,[cite: 1]
    type: 'withdrawal',[cite: 1]
    amount: amount,[cite: 1]
    reference: `WITHDRAW-BANK: ${bankAccount}`[cite: 1]
  }]);

  currentSessionUser.wallet_balance = newBalance;[cite: 1]
  updateWalletUI();[cite: 1]
  alert(`Withdrawal request for R${amount.toFixed(2)} submitted. Funds will deposit into your bank account.`);[cite: 1]
}

function updateWalletUI() {[cite: 1]
  const el = document.getElementById('wallet-balance-text');[cite: 1]
  if (el) {
    el.innerText = `R${parseFloat(currentSessionUser?.wallet_balance || 0).toFixed(2)}`;[cite: 1]
  }
}
