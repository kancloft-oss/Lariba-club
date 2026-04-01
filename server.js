import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  console.log(`Starting server in ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'} mode...`);

  // Use memory storage to avoid permission issues with local filesystem on cloud providers
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'https://s3.twcstorage.ru',
    region: 'ru-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
    forcePathStyle: true,
  });

  // API routes FIRST
  app.post('/api/upload-avatar', (req, res, next) => {
    upload.single('avatar')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).send(`Multer error: ${err.message}`);
      }
      next();
    });
  }, async (req, res) => {
    console.log('Received upload request:', req.file ? `File: ${req.file.originalname}` : 'No file');
    if (!req.file) return res.status(400).send('No file uploaded.');

    if (!process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY || !process.env.S3_BUCKET) {
      console.error('S3 credentials or bucket missing in environment variables');
      return res.status(500).send('S3 configuration missing');
    }

    const fileContent = req.file.buffer;
    const extension = path.extname(req.file.originalname) || '.jpg';
    const key = `avatars/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: req.file.mimetype,
    };

    try {
      await s3Client.send(new PutObjectCommand(params));
      
      const endpoint = process.env.S3_ENDPOINT || 'https://s3.twcstorage.ru';
      const bucket = process.env.S3_BUCKET;
      const fileUrl = `${endpoint}/${bucket}/${key}`;
      
      res.json({ url: fileUrl });
    } catch (error) {
      console.error('S3 upload error details:', error);
      res.status(500).send('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });

  app.get('/api/debug-s3', (req, res) => {
    res.json({
      endpoint: process.env.S3_ENDPOINT || 'https://s3.twcstorage.ru',
      bucket: process.env.S3_BUCKET ? 'Set' : 'Not Set',
      accessKey: process.env.S3_ACCESS_KEY ? `${process.env.S3_ACCESS_KEY.slice(0, 4)}...` : 'Not Set',
      secretKey: process.env.S3_SECRET_KEY ? 'Set' : 'Not Set',
      nodeEnv: process.env.NODE_ENV,
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (!isProd) {
    console.log('Loading Vite middleware...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from the React build directory in production
    const distPath = path.join(__dirname, 'dist');
    console.log(`Serving static files from: ${distPath}`);
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.error('CRITICAL: dist directory not found. Make sure to run npm run build.');
      app.get('*', (req, res) => {
        res.status(500).send('Application not built. Please run npm run build.');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
