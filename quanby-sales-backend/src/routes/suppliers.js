const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabase = require('../index').supabase || createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Add a new supplier
router.post('/suppliers', async (req, res) => {
  try {
    const supplier = req.body;
    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplier])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ supplier: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update supplier by id
router.put('/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updates = req.body;
    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ supplier: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete supplier by id
router.delete('/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all equipments for a supplier by supplier id
router.get('/suppliers/:id/equipments', async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch supplier name by id
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('supplier_name')
      .eq('id', id)
      .single();
    if (supplierError || !supplier) return res.status(404).json({ error: 'Supplier not found' });

    // Fetch all equipment for this supplier
    const { data: equipments, error: equipmentError } = await supabase
      .from('equipments')
      .select('*')
      .eq('supplier', supplier.supplier_name);
    if (equipmentError) return res.status(500).json({ error: equipmentError.message });
    res.json({ equipments });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
