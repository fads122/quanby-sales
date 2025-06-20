require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
const equipmentRoutes = require('./routes/equipment');
const suppliersRoutes = require('./routes/suppliers');
const projectRoutes = require('./routes/project');
const clientRoutes = require('./routes/client');
const partsRoutes = require('./routes/parts');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Example route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from backend API!' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Fetch user profile from 'users' table using the user's id
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('usertype, first_name, last_name, email')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Merge usertype and other profile info into the user object
    const userWithProfile = { ...data.user, ...userProfile };

    res.json({ user: userWithProfile, session: data.session });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/me', async (req, res) => {
  const session = req.headers['authorization'];
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser(session);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('usertype, first_name, last_name, email')
      .eq('id', user.id)
      .single();
    if (profileError) {
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }
    res.json({ user: { ...user, ...userProfile } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logout', async (req, res) => {
  const session = req.headers['authorization'];
  if (!session) {
    return res.status(400).json({ error: 'No session provided' });
  }
  try {
    // Revoke the refresh token (optional, but recommended for security)
    const { error } = await supabase.auth.signOut(session);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all suppliers
app.get('/api/suppliers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ suppliers: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get total equipment count
app.get('/api/total-equipment', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('equipments')
      .select('*', { count: 'exact', head: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ total: count });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get borrowed equipment count
app.get('/api/borrowed-equipment-count', async (req, res) => {
  try {
    const { data: activeRequests, error: requestError } = await supabase
      .from('borrow_requests')
      .select('id')
      .eq('status', 'borrowed');
    if (requestError) return res.status(500).json({ error: requestError.message });
    if (!activeRequests || activeRequests.length === 0) return res.json({ count: 0 });
    const activeRequestIds = activeRequests.map(r => r.id);
    const { data, error } = await supabase
      .from('borrow_request_equipment')
      .select('quantity')
      .in('borrow_request_id', activeRequestIds);
    if (error) return res.status(500).json({ error: error.message });
    const total = data.reduce((sum, item) => sum + item.quantity, 0);
    res.json({ count: total });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get used in projects count
app.get('/api/used-in-projects-count', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('project_materials')
      .select('quantity');
    if (error) return res.status(500).json({ error: error.message });
    const total = data.reduce((sum, item) => sum + item.quantity, 0);
    res.json({ count: total });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent activities
app.get('/api/recent-activities', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recent_activities')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ activities: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get cost history for equipment
app.get('/api/cost-history/:equipmentId', async (req, res) => {
  const { equipmentId } = req.params;
  try {
    const { data, error } = await supabase
      .from('equipment_cost_history')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('date_updated', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ costHistory: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get first cost entry for equipment
app.get('/api/first-cost-entry/:equipmentId', async (req, res) => {
  const { equipmentId } = req.params;
  try {
    const { data, error } = await supabase
      .from('equipment_cost_history')
      .select('*')
      .eq('equipment_id', equipmentId)
      .eq('entry_type', 'initial')
      .order('date_updated', { ascending: true })
      .limit(1)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ firstEntry: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all inhouse equipment
app.get('/api/inhouse-equipment', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inhouse')
      .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ equipment: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all trashed equipment
app.get('/api/trashed-equipment', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('equipments')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ trashed: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Soft delete (move to trash)
app.post('/api/equipment/:id/trash', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const { error } = await supabase
      .from('equipments')
      .update({ deleted_at: new Date().toISOString(), delete_reason: reason })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore equipment from trash
app.post('/api/equipment/:id/restore', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('equipments')
      .update({ deleted_at: null })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete equipment
app.delete('/api/equipment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('equipments')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get assigned equipment
app.get('/api/assigned-equipment', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('borrow_request_equipment')
      .select('id, quantity, equipment_id, inhouse_id')
      .neq('status', 'returned');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ assigned: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all equipment movements
app.get('/api/equipment-movements', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('equipment_movements')
      .select('*')
      .order('movement_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ movements: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get repair logs for equipment
app.get('/api/equipment/:id/repair-logs', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('equipment_repair_logs')
      .select('*')
      .eq('equipment_id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ repairLogs: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Use equipment routes
app.use('/api', equipmentRoutes);
app.use('/api', suppliersRoutes);
app.use('/api', projectRoutes);
app.use('/api', clientRoutes);
app.use('/api', partsRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
