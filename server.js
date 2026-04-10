const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const { fromPath } = require('pdf2pic');
const tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }
});

// Helper: OCR a single image buffer
async function ocrImage(imageBuffer) {
  const { data: { text } } = await tesseract.recognize(imageBuffer, 'eng');
  return text;
}

// Helper: Convert PDF page to image buffer (using pdf2pic)
async function pdfPageToImage(pdfBuffer, pageNum) {
  const tempDir = '/tmp/pdf_images';
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  
  const tempPdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
  const tempImagePath = path.join(tempDir, `page_${pageNum}.png`);
  
  fs.writeFileSync(tempPdfPath, pdfBuffer);
  
  const options = {
    density: 150,
    saveFilename: `page_${pageNum}`,
    savePath: tempDir,
    format: 'png',
    width: 1200,
    height: 1600
  };
  
  const convert = fromPath(tempPdfPath, options);
  await convert(pageNum);
  
  const imageBufferResult = fs.readFileSync(tempImagePath);
  // Cleanup
  fs.unlinkSync(tempPdfPath);
  fs.unlinkSync(tempImagePath);
  
  return imageBufferResult;
}

app.post('/extract-text', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    console.log(`Processing PDF: ${req.file.originalname}, size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Step 1: Try normal text extraction (fast)
    let data = await pdfParse(req.file.buffer);
    let extractedText = data.text;
    let pageCount = data.numpages;
    
    // Step 2: If no text found, fallback to OCR (slow but works for scanned PDFs)
    if (!extractedText || extractedText.trim().length < 20) {
      console.log('No digital text found – falling back to OCR...');
      let ocrText = '';
      
      // Limit to first 20 pages to avoid timeout on free tier
      const maxPages = Math.min(pageCount, 20);
      
      for (let i = 1; i <= maxPages; i++) {
        console.log(`OCR page ${i}/${maxPages}`);
        try {
          const imageBuffer = await pdfPageToImage(req.file.buffer, i);
          const pageText = await ocrImage(imageBuffer);
          ocrText += pageText + '\n\n';
        } catch (err) {
          console.error(`OCR failed on page ${i}:`, err.message);
        }
      }
      
      extractedText = ocrText;
      if (!extractedText.trim()) {
        throw new Error('OCR could not extract any text. The PDF may be corrupted or password-protected.');
      }
    }
    
    const wordCount = extractedText.split(/\s+/).length;
    
    res.json({
      success: true,
      text: extractedText,
      pageCount: pageCount,
      wordCount: wordCount,
      ocrUsed: (extractedText !== data.text)
    });
    
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: error.message || 'Failed to extract text' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
