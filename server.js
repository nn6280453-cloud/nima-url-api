require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 }
});

const IMGBB_KEY = process.env.IMGBB_API_KEY;
const IMGBB_URL = 'https://api.imgbb.com/1/upload';

// 🏠 Health check
app.get('/', (req, res) => {
  res.send('✅ Upload API is running');
});

// 🔍 Debug endpoint
app.get('/api/debug', (req, res) => {
  const key = process.env.IMGBB_API_KEY;
  res.json({
    imgbb: {
      keyExists: !!key,
      keyLength: key ? key.length : 0,
      hasSpaces: key ? (key !== key.trim()) : null
    },
    services: ['catbox', '0x0', 'imgbb'],
    timestamp: new Date().toISOString()
  });
});

// 🌟 Service 1: Catbox.moe (API key ඕන නෑ)
async function uploadToCatbox(buffer, filename = 'image.jpg') {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, {
    filename,
    contentType: 'application/octet-stream'
  });

  const response = await axios.post(
    'https://catbox.moe/user/api.php',
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      timeout: 60000
    }
  );

  const url = String(response.data).trim();
  if (!url || !url.startsWith('http')) {
    throw new Error('Catbox: ' + url);
  }
  return { url, direct_url: url, service: 'catbox' };
}

// 🌟 Service 2: 0x0.st (API key ඕන නෑ)
async function uploadTo0x0(buffer, filename = 'image.jpg') {
  const form = new FormData();
  form.append('file', buffer, { filename });

  const response = await axios.post(
    'https://0x0.st',
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      timeout: 60000
    }
  );

  const url = String(response.data).trim();
  if (!url || !url.startsWith('http')) {
    throw new Error('0x0.st: ' + url);
  }
  return { url, direct_url: url, service: '0x0' };
}

// 🌟 Service 3: ImgBB (fallback)
async function uploadToImgBB(buffer) {
  if (!IMGBB_KEY) throw new Error('No ImgBB API key');

  const base64 = buffer.toString('base64');
  const form = new FormData();
  form.append('image', base64);

  const response = await axios.post(
    `${IMGBB_URL}?key=${IMGBB_KEY}`,
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      timeout: 60000
    }
  );

  const data = response.data.data;
  return {
    url: data.url,
    direct_url: data.display_url,
    delete_url: data.delete_url,
    service: 'imgbb'
  };
}

// 🔄 Smart upload — service එකින් එක try කරනවා
async function uploadImage(buffer, filename = 'image.jpg') {
  const errors = [];

  // 1. Catbox
  try {
    console.log('📤 Trying Catbox...');
    const r = await uploadToCatbox(buffer, filename);
    console.log('✅ Catbox success:', r.url);
    return r;
  } catch (e) {
    console.error('❌ Catbox failed:', e.message);
    errors.push({ service: 'catbox', error: e.message });
  }

  // 2. 0x0.st
  try {
    console.log('📤 Trying 0x0.st...');
    const r = await uploadTo0x0(buffer, filename);
    console.log('✅ 0x0.st success:', r.url);
    return r;
  } catch (e) {
    console.error('❌ 0x0.st failed:', e.message);
    errors.push({ service: '0x0', error: e.message });
  }

  // 3. ImgBB
  if (IMGBB_KEY) {
    try {
      console.log('📤 Trying ImgBB...');
      const r = await uploadToImgBB(buffer);
      console.log('✅ ImgBB success:', r.url);
      return r;
    } catch (e) {
      console.error('❌ ImgBB failed:', e.message);
      errors.push({ service: 'imgbb', error: e.message });
    }
  }

  throw new Error('All services failed: ' + JSON.stringify(errors));
}

// 📤 File upload endpoint
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image provided. Use field name "image"'
      });
    }

    const result = await uploadImage(req.file.buffer, req.file.originalname);

    res.json({ success: true, ...result });

  } catch (err) {
    console.error('❌ Upload error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: err.message
    });
  }
});

// 📤 Base64 endpoint (bot එකට ලේසිම)
app.post('/api/upload-base64', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'No image base64 provided'
      });
    }

    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid base64 data'
      });
    }

    const result = await uploadImage(buffer);

    res.json({ success: true, ...result });

  } catch (err) {
    console.error('❌ Upload error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📤 Upload services: Catbox → 0x0.st → ImgBB`);
});
