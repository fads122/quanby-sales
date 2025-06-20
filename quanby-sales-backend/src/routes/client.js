const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Get all unique clients with their projects
router.get('/clients-with-projects', async (req, res) => {
  try {
    // Fetch all projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*');
    if (projectsError) return res.status(500).json({ error: projectsError.message });

    // Group projects by client_name
    const clientsMap = new Map();
    projects.forEach(project => {
      const clientKey = project.client_name || 'Unknown';
      if (!clientsMap.has(clientKey)) {
        clientsMap.set(clientKey, {
          client_name: project.client_name,
          client_email: project.client_email,
          client_phone: project.client_phone,
          client_address: project.client_address,
          projects: []
        });
      }
      clientsMap.get(clientKey).projects.push(project);
    });
    const clients = Array.from(clientsMap.values());
    res.json({ clients });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all delivery receipts
router.get('/delivery-receipts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('delivery_receipts')
      .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deliveryReceipts: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// (Optional) Get all unique clients
router.get('/clients', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('client_name, client_email, client_phone, client_address');
    if (error) return res.status(500).json({ error: error.message });
    // Deduplicate by client_name
    const uniqueClients = Array.from(new Map(data.map(c => [c.client_name, c])).values());
    res.json({ clients: uniqueClients });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// (Optional) Get all projects for a specific client
router.get('/clients/:clientName/projects', async (req, res) => {
  const { clientName } = req.params;
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('client_name', clientName);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ projects: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- DELIVERY RECEIPTS CRUD ---

// Get a single delivery receipt by id
router.get('/delivery-receipts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('delivery_receipts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return res.status(404).json({ error: error.message });
    res.json({ deliveryReceipt: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new delivery receipt
router.post('/delivery-receipts', async (req, res) => {
  const receipt = req.body;
  try {
    const { data, error } = await supabase
      .from('delivery_receipts')
      .insert([receipt])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ deliveryReceipt: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a delivery receipt
router.put('/delivery-receipts/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const { data, error } = await supabase
      .from('delivery_receipts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ deliveryReceipt: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a delivery receipt
router.delete('/delivery-receipts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('delivery_receipts')
      .delete()
      .eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
