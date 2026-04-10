const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ 
  storage: multer.diskStorage({
    destination: '/tmp',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 200 * 1024 * 1024 }
});

app.post('/extract-text', upload.single('pdf'), async (req, res) => {
  const inputPdf = req.file.path;
  const outputPdf = `/tmp/ocr_${Date.now()}.pdf`;
  const txtFile = `/tmp/text_${Date.now()}.txt`;

  try {
    // Run OCRmyPDF to add text layer
    await execPromise(`ocrmypdf --force-ocr --output-type pdf ${inputPdf} ${outputPdf}`);
    // Extract text from the OCRed PDF
    await execPromise(`pdftotext ${outputPdf} ${txtFile}`);
    const extractedText = fs.readFileSync(txtFile, 'utf8');
    res.json({ success: true, text: extractedText });
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ error: 'Failed to process PDF. It may be corrupted or password-protected.' });
  } finally {
    // Cleanup temp files
    [inputPdf, outputPdf, txtFile].forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
