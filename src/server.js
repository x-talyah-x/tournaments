import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------------------
// 1. SUPABASE CLIENT SETUP
// -----------------------------------------------------------------------------
// Note: Use environment variables in production (e.g., process.env.SUPABASE_URL)
const SUPABASE_URL = process.env.SUPABASE_URL || "https://fetpncdjrmfknofvekqc.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -----------------------------------------------------------------------------
// 2. AUTHENTICATION MIDDLEWARE
// -----------------------------------------------------------------------------
// Middleware to verify the Bearer JWT token sent from the client headers
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  next();
}

// -----------------------------------------------------------------------------
// 3. AUTHENTICATION ENDPOINTS
// -----------------------------------------------------------------------------

// REGISTER / SIGN UP
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, playerName, gender, dob } = req.body;

  if (!email || !password || !playerName) {
    return res.status(400).json({ error: 'Email, password, and player name are required.' });
  }

  // 1. Create standard auth user in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        player_name: playerName,
        gender: gender,
        dob: dob
      }
    }
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // 2. Create public profile entry linked to the auth user ID
  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          email: email,
          player_name: playerName,
          gender: gender,
          dob: dob
        }
      ]);

    if (profileError) {
      console.error("Profile creation error:", profileError.message);
    }
  }

  res.status(201).json({ message: 'User registered successfully', user: data.user, session: data.session });
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  res.json({
    message: 'Logged in successfully',
    access_token: data.session.access_token,
    user: data.user
  });
});

// LOGOUT
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  const { error } = await supabase.auth.signOut();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Logged out successfully' });
});

// -----------------------------------------------------------------------------
// 4. PUBLIC DATA & PROFILE ENDPOINTS
// -----------------------------------------------------------------------------

// Fetch public player profiles
app.get('/api/profiles', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, player_name, gender')
    .order('player_name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Fetch tournaments with registrations and participant profiles
app.get('/api/tournaments', async (req, res) => {
  const { data, error } = await supabase
    .from('tournaments')
    .select(`
      *,
      registrations (
        id,
        created_at,
        profiles (
          id,
          player_name,
          gender
        )
      )
    `)
    .order('event_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// -----------------------------------------------------------------------------
// 5. PROTECTED ACTIONS (REQUIRES AUTHENTICATION)
// -----------------------------------------------------------------------------

// Join a tournament
app.post('/api/tournaments/register', authenticateToken, async (req, res) => {
  const { tournamentId, profileId } = req.body;

  if (!tournamentId || !profileId) {
    return res.status(400).json({ error: 'Tournament ID and Profile ID are required.' });
  }

  const { data, error } = await supabase
    .from('registrations')
    .insert([
      {
        tournament_id: tournamentId,
        profile_id: profileId
      }
    ])
    .select();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'User is already registered for this tournament.' });
    }
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({ message: 'Registered for tournament', data });
});

// Create tournament (Admin)
app.post('/api/tournaments', authenticateToken, async (req, res) => {
  const { name, eventDate, gameType, raceNumber, format, targetGender } = req.body;

  if (!name || !eventDate) {
    return res.status(400).json({ error: 'Name and event date are required.' });
  }

  // Ensure date is properly stored as an ISO timestamp string
  const formattedDate = new Date(eventDate).toISOString();
  const raceToText = `Race to ${raceNumber || 1}`;

  const { data, error } = await supabase
    .from('tournaments')
    .insert([
      {
        name,
        event_date: formattedDate,
        game_type: gameType,
        race_to: raceToText,
        format,
        target_gender: targetGender
      }
    ])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ message: 'Tournament created successfully', tournament: data[0] });
});

// Delete tournament
app.delete('/api/tournaments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('tournaments')
    .delete()
    .eq('id', id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Tournament deleted successfully' });
});

// Remove participant registration
app.delete('/api/registrations/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('registrations')
    .delete()
    .eq('id', id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Participant removed' });
});

// -----------------------------------------------------------------------------
// 6. START SERVER
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
