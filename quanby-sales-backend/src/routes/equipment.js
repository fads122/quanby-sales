const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use the same Supabase client config as index.js
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Get all equipment (for-sale)
router.get('/equipment-list', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('equipments')
      .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ equipment: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add for-sale equipment
router.post('/equipment', async (req, res) => {
  try {
    const equipment = req.body;
    const { data, error } = await supabase
      .from('equipments')
      .insert([equipment])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ equipment: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single equipment item by ID
router.get('/equipment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('equipments')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return res.status(404).json({ error: error.message });
    res.json({ equipment: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update equipment by ID
router.put('/equipment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('equipments')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ equipment: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a repair log for equipment
router.post('/equipment/:id/repair-logs', async (req, res) => {
  const { id } = req.params;
  const log = { ...req.body, equipment_id: id };
  try {
    const { data, error } = await supabase
      .from('equipment_repair_logs')
      .insert([log])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ repairLog: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a repair log
router.put('/equipment/:id/repair-logs/:logId', async (req, res) => {
  const { logId } = req.params;
  try {
    const { data, error } = await supabase
      .from('equipment_repair_logs')
      .update(req.body)
      .eq('id', logId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ repairLog: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a repair log
router.delete('/equipment/:id/repair-logs/:logId', async (req, res) => {
  const { logId } = req.params;
  try {
    const { error } = await supabase
      .from('equipment_repair_logs')
      .delete()
      .eq('id', logId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add an image to equipment
router.post('/equipment/:id/images', async (req, res) => {
  const { id } = req.params;
  const { image_url } = req.body;
  try {
    const { data, error } = await supabase
      .from('equipment_images')
      .insert([{ equipment_id: id, image_url }])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ image: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an image from equipment
router.delete('/equipment/:id/images/:imageId', async (req, res) => {
  const { imageId } = req.params;
  try {
    const { error } = await supabase
      .from('equipment_images')
      .delete()
      .eq('id', imageId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add inhouse equipment
router.post('/inhouse-equipment', async (req, res) => {
  try {
    const equipment = req.body;
    const { data, error } = await supabase
      .from('inhouse')
      .insert([equipment])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ equipment: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ALL equipment (for project materials enrichment)
router.get('/equipment-all', async (req, res) => {
  try {
    // Fetch all from 'equipments' table
    const { data: equipmentData, error: equipmentError } = await supabase
      .from('equipments')
      .select('*');
    if (equipmentError) return res.status(500).json({ error: equipmentError.message });

    // Fetch all from 'inhouse' table (if you use both)
    const { data: inhouseData, error: inhouseError } = await supabase
      .from('inhouse')
      .select('*');
    if (inhouseError) return res.status(500).json({ error: inhouseError.message });

    // Combine both tables (if both exist)
    const allEquipment = [...(equipmentData || []), ...(inhouseData || [])];
    res.json({ equipment: allEquipment });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- BORROW REQUESTS API ---

// Get all borrow requests (optionally filter by user_id)
router.get('/borrow-requests', async (req, res) => {
  try {
    let query = supabase.from('borrow_requests').select('*').order('borrow_date', { ascending: false });
    if (req.query.user_id) query = query.eq('user_id', req.query.user_id);
    if (req.query.status) query = query.eq('status', req.query.status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ requests: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single borrow request with its equipment list
router.get('/borrow-requests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: request, error } = await supabase.from('borrow_requests').select('*').eq('id', id).single();
    if (error) return res.status(404).json({ error: error.message });
    const { data: equipment, error: eqError } = await supabase.from('borrow_request_equipment').select('*').eq('borrow_request_id', id);
    if (eqError) return res.status(500).json({ error: eqError.message });
    res.json({ request, equipment });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new borrow request
router.post('/borrow-requests', async (req, res) => {
  try {
    const { data, error } = await supabase.from('borrow_requests').insert([req.body]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ request: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a borrow request
router.put('/borrow-requests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('borrow_requests').update(req.body).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ request: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a borrow request
router.delete('/borrow-requests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('borrow_requests').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- BORROW REQUEST EQUIPMENT API ---

// Get all borrow request equipment (optionally filter by borrow_request_id)
router.get('/borrow-request-equipment', async (req, res) => {
  try {
    let query = supabase.from('borrow_request_equipment').select('*');
    if (req.query.borrow_request_id) query = query.eq('borrow_request_id', req.query.borrow_request_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ equipment: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add equipment to a borrow request
router.post('/borrow-request-equipment', async (req, res) => {
  try {
    const { data, error } = await supabase.from('borrow_request_equipment').insert(req.body).select();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ equipment: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update borrow request equipment
router.put('/borrow-request-equipment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('borrow_request_equipment').update(req.body).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ equipment: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete borrow request equipment
router.delete('/borrow-request-equipment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('borrow_request_equipment').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 