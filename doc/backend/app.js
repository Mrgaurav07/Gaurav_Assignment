const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const docxConverter = require('docx-pdf');
const { promisify } = require('util');

const app = express();
const port = 5000;

// Enable CORS
app.use(cors());

// Create uploads and output directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
[uploadsDir, outputDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  console.log('Received file:', file.originalname, 'Type:', file.mimetype);
  const allowedMimes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only Word documents are allowed.`));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Promisify the docx-pdf convert function
const convertToPdf = promisify(docxConverter);

// Serve static files from output directory
app.use('/output', express.static(outputDir));

// Add a route to download PDF files
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(outputDir, filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Upload and convert endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  console.log('Received upload request');

  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    console.log('File received:', req.file);

    const inputPath = req.file.path;
    const outputFilename = path.basename(inputPath, path.extname(inputPath)) + '.pdf';
    const outputPath = path.join(outputDir, outputFilename);

    console.log('Starting conversion...');
    await convertToPdf(inputPath, outputPath);
    console.log('Conversion completed');

    const metadata = {
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
      uploadTime: new Date().toISOString()
    };

    // Clean up the uploaded Word file
    await fs.promises.unlink(inputPath);
    console.log('Cleaned up input file');

    const downloadUrl = `/download/${outputFilename}`;
    const fileUrl = `/output/${outputFilename}`;

    console.log('Sending response with PDF URLs:', { downloadUrl, fileUrl });

    res.json({
      metadata,
      pdfUrl: downloadUrl,
      fileUrl: fileUrl
    });

  } catch (error) {
    console.error('Error occurred during file processing:', error);
    console.error('Stack trace:', error.stack);

    // Clean up uploaded file if it exists
    if (req.file) {
      try {
        await fs.promises.unlink(req.file.path);
        console.log('Cleaned up uploaded file after error');
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      message: 'Error processing file',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File is too large. Maximum size is 10MB'
      });
    }
    return res.status(400).json({
      message: error.message
    });
  }

  res.status(500).json({
    message: error.message || 'Internal server error'
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Upload directory: ${uploadsDir}`);
  console.log(`Output directory: ${outputDir}`);
});
