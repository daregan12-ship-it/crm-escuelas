const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.SAVE_SERVER_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const outDir = path.resolve(__dirname, '../data');
const outFile = path.join(outDir, 'crm-data.json');

app.post('/save-json', async (req, res) => {
  try {
    const payload = req.body || {};
    // ensure output directory exists
    fs.mkdirSync(outDir, { recursive: true });
    const now = new Date().toISOString();
    const out = {
      savedAt: now,
      payload,
    };
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
    console.log('Saved crm-data.json to', outFile);
    res.json({ ok: true, path: outFile });
  } catch (err) {
    console.error('Error saving JSON', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get('/ping', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Save-data server listening on http://localhost:${PORT}`));

// allow running directly with node
if (require.main === module) {
  // noop
}
