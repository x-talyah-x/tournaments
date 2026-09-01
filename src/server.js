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

  // Check if the email already exists in the database
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

  // Hash password before sending to database
  const hashedPassword = await hashPassword(password);

  // Insert new user profile
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

  renderTournaments();
}

function handleLogOut() {
  currentSessionUser = null;
  setSessionUser(null);
  alert("Logged out.");
  togglePlayerProfilePanel();
}

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
  if (diffDays > 1 && diffDays <= 7) return 'This Week';
  if (diffDays > 7 && diffDays <= 14) return 'Next Week';
  return 'Later';
}

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
        
        // Format entry fee badge text
        const entryFeeText = (t.entry_fee !== null && t.entry_fee !== undefined && t.entry_fee > 0) 
          ? `R${t.entry_fee}` 
          : 'FREE ENTRY';

        const userRegistration = currentSessionUser 
          ? entries.find(e => e.profiles?.id === currentSessionUser.id)
          : null;

        const isGenderEligible = !currentSessionUser || targetGender === 'All' || currentSessionUser.gender === targetGender;

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
  
  // Extract entry fee field value (FIXED ID MATCHING HTML)
  const entryFeeInput = document.getElementById('t-entry')?.value;
  const entryFee = entryFeeInput ? parseFloat(entryFeeInput) : 0;

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
        is_doubles: isDoubles,
        entry_fee: entryFee
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
// Add your Paystack Public Key here
const PAYSTACK_PUBLIC_KEY = "pk_test_17655c4677eb0a914b9bf7557869ac2749f81744"; // Replace with your Paystack Public Key

// Updated Signup / Payment Trigger Function
async function handleSignup(e, tournamentId, isDoubles) {
  e.preventDefault();

  if (!currentSessionUser) {
    alert("You must be logged in to register for a tournament.");
    togglePlayerProfilePanel();
    return;
  }

  // Find the tournament details
  const tournament = tournamentsData.find(t => t.id === tournamentId);
  if (!tournament) {
    alert("Tournament not found.");
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

  const entryFee = tournament.entry_fee || 0;

  // Case A: Free Tournament -> Direct Database Entry
  if (entryFee <= 0) {
    await completeRegistration({
      tournamentId,
      profileId: currentSessionUser.id,
      partnerName,
      paymentStatus: 'free',
      reference: `FREE-${Date.now()}`
    });
    return;
  }

  // Case B: Paid Tournament -> Launch Paystack Gateway
  payWithPaystack({
    amount: entryFee,
    email: currentSessionUser.email,
    tournamentId: tournamentId,
    partnerName: partnerName
  });
}

// Paystack Gateway Handler
function payWithPaystack({ amount, email, tournamentId, partnerName }) {
  const reference = `BB-${tournamentId.substring(0, 5)}-${Date.now()}`;

  // Dedicated callback handler function
  function handlePaystackSuccess(response) {
    alert(`Payment successful! Reference: ${response.reference}`);
    
    completeRegistration({
      tournamentId: tournamentId,
      profileId: currentSessionUser.id,
      partnerName: partnerName,
      paymentStatus: 'paid',
      reference: response.reference,
      amount: amount
    });
  }

  // Dedicated onClose handler function
  function handlePaystackClose() {
    alert('Payment window closed. Registration was not completed.');
  }

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: Math.round(amount * 100), // Ensures exact integer for cents
    currency: 'ZAR',
    ref: reference,
    metadata: {
      custom_fields: [
        { display_name: "Player Name", variable_name: "player_name", value: currentSessionUser.player_name },
        { display_name: "Tournament ID", variable_name: "tournament_id", value: tournamentId }
      ]
    },
    callback: handlePaystackSuccess,
    onClose: handlePaystackClose
  });

  handler.openIframe();
}

// Complete Database Insertion after successful payment
async function completeRegistration({ tournamentId, profileId, partnerName, paymentStatus, reference, amount = 0 }) {
  const { error } = await supabaseClient
    .from('registrations')
    .insert([{ 
      tournament_id: tournamentId, 
      profile_id: profileId,
      partner_name: partnerName,
      payment_status: paymentStatus,
      payment_reference: reference,
      paid_amount: amount
    }]);

  if (error) {
    console.error("Error signing up:", error);
    if (error.code === '23505' || (error.message && error.message.includes('unique constraint'))) {
      alert("You are already registered for this tournament.");
    } else {
      alert("Failed to complete registration: " + error.message);
    }
  } else {
    alert("Successfully registered for the tournament!");
    await loadTournaments();
  }
}

// ==========================================
// 1. CANCELLATION & REFUND LOGGING
// ==========================================
async function removeParticipant(entryId, targetProfileId = null) {
  const isOwner = currentSessionUser && targetProfileId && currentSessionUser.id === targetProfileId;

  if (!isAdmin && !isOwner && targetProfileId !== null) {
    alert("You can only remove your own entry.");
    return;
  }

  if (!confirm("Are you sure you want to cancel this registration?")) return;

  // Fetch registration details including profile & tournament info
  const { data: registrationData, error: fetchErr } = await supabaseClient
    .from('registrations')
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
    .eq('id', entryId)
    .maybeSingle();

  if (fetchErr || !registrationData) {
    alert("Could not fetch registration details.");
    return;
  }

  const isPaid = registrationData.payment_status === 'paid' && registrationData.paid_amount > 0;

  // If paid, log a pending entry into refund_requests BEFORE deleting registration
  if (isPaid) {
    const tournamentTitle = registrationData.tournaments?.name || registrationData.tournaments?.game_type || 'Unknown Event';
    const playerName = registrationData.profiles?.player_name || currentSessionUser?.player_name || 'Unknown';
    const playerEmail = registrationData.profiles?.email || currentSessionUser?.email || 'N/A';

    const { error: refundLogErr } = await supabaseClient
      .from('refund_requests')
      .insert([{
        registration_id: entryId,
        tournament_name: tournamentTitle,
        player_name: playerName,
        player_email: playerEmail,
        payment_reference: registrationData.payment_reference || 'N/A',
        amount: registrationData.paid_amount,
        status: 'pending'
      }]);

    if (refundLogErr) {
      alert("Failed to record refund request: " + refundLogErr.message);
      return;
    }
  }

  // Delete registration record
  const { error: deleteError } = await supabaseClient
    .from('registrations')
    .delete()
    .eq('id', entryId);

  if (deleteError) {
    alert("Failed to remove registration: " + deleteError.message);
  } else {
    alert("Registration canceled successfully." + (isPaid ? " Your refund request has been logged for admin payout." : ""));
    if (typeof loadTournaments === 'function') await loadTournaments();
    if (isAdmin && typeof loadRefundRequests === 'function') await loadRefundRequests();
  }
}

// ==========================================
// 2. ADMIN REFUND MANAGEMENT
// ==========================================

// Fetch and render refund requests table
async function loadRefundRequests() {
  const container = document.getElementById('admin-refunds-container');
  if (!container) return;

  container.innerHTML = `<p style="color: #94a3b8; font-size: 0.85rem;">Loading refund requests...</p>`;

  // Filter query to only fetch 'pending' status rows
  const { data: requests, error } = await supabaseClient
    .from('refund_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<p style="color: var(--danger); font-size: 0.85rem;">Error loading refunds: ${error.message}</p>`;
    return;
  }

  if (!requests || requests.length === 0) {
    container.innerHTML = `<p style="color: #64748b; font-size: 0.85rem;">No unpaid refund requests found.</p>`;
    return;
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
  `;

  requests.forEach(req => {
    const dateFormatted = new Date(req.created_at).toLocaleDateString('en-ZA', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const statusBadge = `<span class="badge" style="background:#854d0e; color:#fef08a;">Pending</span>`;

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
          <button 
            class="btn btn-danger" 
            style="padding: 3px 8px; font-size: 0.75rem;"
            onclick="updateRefundStatus('${req.id}', 'rejected')">
            ✕
          </button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}
// Update the status of a refund request (Mark as Paid/Rejected)
async function updateRefundStatus(refundId, newStatus) {
  const actionText = newStatus === 'completed' ? 'mark as PROCESSED / PAID' : 'REJECT';
  if (!confirm(`Are you sure you want to ${actionText} this refund request?`)) return;

  const { error } = await supabaseClient
    .from('refund_requests')
    .update({ status: newStatus })
    .eq('id', refundId);

  if (error) {
    alert("Failed to update status: " + error.message);
  } else {
    await loadRefundRequests();
  }
}

// XSS Sanitization Helper
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
    loadRefundRequests(); // <-- Add this call
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
  if (panel) {
    panel.classList.toggle('visible');
  }
}
