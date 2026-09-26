require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Memory storage (file save කරන්නේ නෑ)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 } // 32MB max
});

const IMGBB_KEY = process.env.IMGBB_API_KEY;
const IMGBB_URL = 'https://api.imgbb.com/1/upload';

// 🏠 Health check
app.get('/', (req, res) => {
  res.send('✅ ImgBB Upload API is running');
});

// 📤 Main endpoint: File upload
// POST /api/upload  (multipart/form-data, field name: "image")
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image provided. Use field name "image"'
      });
    }

    const base64 = req.file.buffer.toString('base64');

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

    res.json({
      success: true,
      url: data.url,               // 👈 Viewer link
      direct_url: data.display_url, // 👈 Direct image link
      delete_url: data.delete_url,  // Delete කරන්න
      thumb: data.thumb?.url,
      width: data.width,
      height: data.height,
      size: data.size
    });

  } catch (err) {
    console.error('Upload error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: err.response?.data?.error?.message || err.message
    });
  }
});

// 📤 Base64 endpoint (bot එකට ලේසිම)
// POST /api/upload-base64  { "image": "base64string" }
app.post('/api/upload-base64', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'No image base64 provided'
      });
    }

    // data:image/jpeg;base64,  කොටස අයින් කරන්න
    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');

    const form = new FormData();
    form.append('image', cleanBase64);

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

    res.json({
      success: true,
      url: data.url,
      direct_url: data.display_url,
      delete_url: data.delete_url
    });

  } catch (err) {
    console.error('Upload error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: err.response?.data?.error?.message || err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
