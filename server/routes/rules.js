const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getSheetData, appendSheetData, updateSheetData } = require('../sheets');

// GET /api/rules – все правила
router.get('/', auth, async (req, res) => {
  try {
    const rules = await getSheetData('Rules!A:D'); // keyword, response, active, id
    const result = rules.map((row, idx) => ({
      id: row[3] || (idx + 1),
      keyword: row[0] || '',
      response: row[1] || '',
      active: row[2] === 'TRUE'
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки правил' });
  }
});

// POST /api/rules – создать правило
router.post('/', auth, async (req, res) => {
  const { keyword, response, active } = req.body;
  if (!keyword || !response) {
    return res.status(400).json({ error: 'Ключевое слово и ответ обязательны' });
  }

  try {
    const rules = await getSheetData('Rules!A:D');
    const newId = rules.length + 1;
    await appendSheetData('Rules!A:D', [
      [keyword, response, active ? 'TRUE' : 'FALSE', newId]
    ]);
    res.json({ success: true, id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка добавления правила' });
  }
});

// PUT /api/rules/:id – обновить правило
router.put('/:id', auth, async (req, res) => {
  const id = req.params.id;
  const { keyword, response, active } = req.body;
  try {
    const rules = await getSheetData('Rules!A:D');
    const rowIndex = rules.findIndex(row => row[3] == id) + 2;
    if (rowIndex < 2) {
      return res.status(404).json({ error: 'Правило не найдено' });
    }
    await updateSheetData(`Rules!A${rowIndex}:D${rowIndex}`, [
      [keyword, response, active ? 'TRUE' : 'FALSE', id]
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// DELETE /api/rules/:id – удалить правило (очистить строку)
router.delete('/:id', auth, async (req, res) => {
  const id = req.params.id;
  try {
    const rules = await getSheetData('Rules!A:D');
    const rowIndex = rules.findIndex(row => row[3] == id) + 2;
    if (rowIndex < 2) {
      return res.status(404).json({ error: 'Правило не найдено' });
    }
    // Очищаем ячейки (можно также удалить строку, но это сложнее)
    await updateSheetData(`Rules!A${rowIndex}:D${rowIndex}`, [['', '', '', '']]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

module.exports = router;