const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Get all PC parts
router.get('/pc-parts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('equipments')
      .select('*')
      .eq('category', 'PC Parts');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ pcParts: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get PC part metadata (optionally by part IDs)
router.get('/pc-part-metadata', async (req, res) => {
  try {
    let query = supabase.from('pc_part_metadata').select('*');
    if (req.query.ids) {
      const ids = req.query.ids.split(',');
      query = query.in('equipment_id', ids);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ metadata: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Compatibility check
router.post('/compatibility', async (req, res) => {
  try {
    const { partIds } = req.body;
    if (!Array.isArray(partIds)) return res.status(400).json({ error: 'partIds must be an array' });
    const { data, error } = await supabase
      .from('pc_part_metadata')
      .select('*')
      .in('equipment_id', partIds);
    if (error) return res.status(500).json({ error: error.message });
    // Compatibility logic (same as frontend)
    const issues = [];
    const cpu = data.find(p => p.category === 'CPU');
    const motherboard = data.find(p => p.category === 'Motherboard');
    if (cpu && motherboard) {
      if (!motherboard.supported_sockets.includes(cpu.cpu_socket)) {
        issues.push(`CPU socket (${cpu.cpu_socket}) not supported by motherboard`);
      }
    }
    const rams = data.filter(p => p.category === 'RAM');
    if (rams.length && motherboard) {
      rams.forEach(ram => {
        if (ram.ram_type !== motherboard.ram_type) {
          issues.push(`RAM type (${ram.ram_type}) not supported by motherboard`);
        }
      });
      if (rams.length > motherboard.ram_slots) {
        issues.push(`Not enough RAM slots on motherboard (needs ${rams.length}, has ${motherboard.ram_slots})`);
      }
    }
    res.json({ compatible: issues.length === 0, issues });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Saved equipment sets
router.get('/saved-equipment', async (req, res) => {
  try {
    let query = supabase.from('saved_equipment').select('*').order('timestamp', { ascending: false });
    if (req.query.user_id) query = query.eq('user_id', req.query.user_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ saved: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/saved-equipment', async (req, res) => {
  try {
    const entry = req.body;
    const { data, error } = await supabase
      .from('saved_equipment')
      .insert([entry])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ saved: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/saved-equipment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('saved_equipment')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// (Optional) Semantic search proxy
router.post('/semantic-search', async (req, res) => {
  try {
    const { query, threshold = 0.3, match_count = 20 } = req.body;
    if (!query) return res.status(400).json({ error: 'Missing query' });
    // This assumes the backend has access to the model or can proxy to Supabase RPC
    // For now, just proxy to Supabase RPC
    // (You may want to move the model to the backend for full decoupling)
    // You may need to implement embedding logic here if not using Supabase RPC
    // For now, return 501 Not Implemented
    res.status(501).json({ error: 'Semantic search not implemented on backend. Use Supabase RPC or move model to backend.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 