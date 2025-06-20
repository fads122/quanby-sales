const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Get all projects (optionally filtered by userId)
router.get('/projects', async (req, res) => {
  const userId = req.query.userId;
  try {
    let query = supabase.from('projects').select('*');
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ projects: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single project by ID
router.get('/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
    if (error) return res.status(404).json({ error: error.message });
    res.json({ project: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new project
router.post('/projects', async (req, res) => {
  try {
    const project = req.body;
    const { data, error } = await supabase.from('projects').insert([project]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ project: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a project
router.put('/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updates = req.body;
    const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ project: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a project
router.delete('/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all project materials for a project
router.get('/projects/:id/materials', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('project_materials').select('*').eq('project_id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ materials: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add materials to a project
router.post('/projects/:id/materials', async (req, res) => {
  const { id } = req.params;
  const materials = req.body.materials;
  try {
    const inserts = materials.map(m => ({ ...m, project_id: id }));
    const { data, error } = await supabase.from('project_materials').insert(inserts).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ materials: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a project material
router.put('/project-materials/:materialId', async (req, res) => {
  const { materialId } = req.params;
  try {
    const updates = req.body;
    const { data, error } = await supabase.from('project_materials').update(updates).eq('id', materialId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ material: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a project material
router.delete('/project-materials/:materialId', async (req, res) => {
  const { materialId } = req.params;
  try {
    const { error } = await supabase.from('project_materials').delete().eq('id', materialId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 