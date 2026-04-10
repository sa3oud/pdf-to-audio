// DOM elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const controlsDiv = document.getElementById('controls');
const textArea = document.getElementById('textContent');
const editBtn = document.getElementById('editBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const speakBtn = document.getElementById('speakBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');
const voiceSelect = document.getElementById('voiceSelect');
const rateSlider = document.getElementById('rate');
const rateValue = document.getElementById('rateValue');
const pitchSlider = document.getElementById('pitch');
const pitchValue = document.getElementById('pitchValue');
const statusDiv = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const ocrProgress = document.getElementById('ocrProgress');
const progressText = document.getElementById('progressText');

let extractedText = '';
let currentUtterance = null;
let availableVoices = [];

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

function setStatus(msg, isError = false) {
  statusDiv.innerHTML = msg;
  statusDiv.style.background = isError ? '#7f1a1a' : '#0f172a';
  console.log(msg);
}

// Load voices
function loadVoices() {
  availableVoices = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
  (englishVoices.length ? englishVoices : availableVoices).forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
  const preferred = availableVoices.find(v => v.name.includes('Google UK') || v.name.includes('Samantha') || v.name.includes('Microsoft'));
  if (preferred) voiceSelect.value = preferred.name;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

// Drag & drop
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});
uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') handlePDF(file);
  else setStatus('❌ Please drop a PDF file.', true);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handlePDF(e.target.files[0]);
});

// Convert PDF page to image (using canvas)
async function pdfPageToImage(page, scale = 2) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

// OCR using Tesseract.js
async function ocrImage(canvas, pageNum) {
  return new Promise((resolve, reject) => {
    Tesseract.recognize(canvas, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          progressText.innerText = `OCR page ${pageNum}: ${Math.round(m.progress * 100)}%`;
        }
      }
    }).then(({ data: { text } }) => resolve(text))
      .catch(reject);
  });
}

// Main PDF handler with OCR fallback
async function handlePDF(file) {
  setStatus(`📖 Loading PDF...`);
  controlsDiv.style.display = 'none';
  progressContainer.style.display = 'block';
  ocrProgress.value = 0;
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  let fullText = '';
  let usedOCR = false;
  
  // First try regular text extraction (fast)
  setStatus(`Extracting text from ${numPages} pages...`);
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
    ocrProgress.value = (i / numPages) * 100;
    progressText.innerText = `Extracting page ${i}/${numPages}`;
  }
  
  // If little or no text, run OCR on each page
  if (fullText.trim().length < 100) {
    setStatus(`📸 Low text detected – running OCR (this may take a while)...`);
    usedOCR = true;
    fullText = '';
    for (let i = 1; i <= numPages; i++) {
      progressText.innerText = `Converting page ${i}/${numPages} to image...`;
      const page = await pdf.getPage(i);
      const canvas = await pdfPageToImage(page);
      progressText.innerText = `OCR page ${i}/${numPages}...`;
      const ocrText = await ocrImage(canvas, i);
      fullText += ocrText + '\n\n';
      ocrProgress.value = (i / numPages) * 100;
    }
  }
  
  extractedText = fullText.trim();
  if (!extractedText) {
    setStatus('❌ No text found even after OCR. The PDF may be corrupted or password-protected.', true);
    progressContainer.style.display = 'none';
    return;
  }
  
  const wordCount = extractedText.split(/\s+/).length;
  textArea.value = extractedText;
  controlsDiv.style.display = 'block';
  progressContainer.style.display = 'none';
  setStatus(`✅ ${wordCount} words extracted${usedOCR ? ' using OCR' : ''}. Ready to speak.`);
}

// Edit mode
editBtn.addEventListener('click', () => {
  textArea.readOnly = false;
  editBtn.style.display = 'none';
  saveEditBtn.style.display = 'inline-block';
  setStatus('✏️ Edit text, then click Save.');
});
saveEditBtn.addEventListener('click', () => {
  extractedText = textArea.value;
  textArea.readOnly = true;
  saveEditBtn.style.display = 'none';
  editBtn.style.display = 'inline-block';
  setStatus('✅ Text saved.');
});

// Speech functions
function stopSpeaking() {
  if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
  setStatus('⏹️ Stopped.');
}
function speakText() {
  if (!extractedText) {
    setStatus('⚠️ No text to speak.', true);
    return;
  }
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(extractedText);
  const selectedVoiceName = voiceSelect.value;
  const voice = availableVoices.find(v => v.name === selectedVoiceName);
  if (voice) utterance.voice = voice;
  utterance.rate = parseFloat(rateSlider.value);
  utterance.pitch = parseFloat(pitchSlider.value);
  utterance.onstart = () => { setStatus('🔊 Speaking...'); currentUtterance = utterance; };
  utterance.onend = () => { setStatus('✅ Finished.'); currentUtterance = null; };
  utterance.onerror = (err) => {
    console.error(err);
    setStatus('❌ Speech error.', true);
    currentUtterance = null;
  };
  window.speechSynthesis.speak(utterance);
}
function pauseSpeaking() {
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
    setStatus('⏸️ Paused.');
  }
}
function resumeSpeaking() {
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    setStatus('🔊 Speaking...');
  }
}

speakBtn.addEventListener('click', speakText);
pauseBtn.addEventListener('click', pauseSpeaking);
resumeBtn.addEventListener('click', resumeSpeaking);
stopBtn.addEventListener('click', stopSpeaking);
rateSlider.addEventListener('input', () => { rateValue.textContent = rateSlider.value; });
pitchSlider.addEventListener('input', () => { pitchValue.textContent = pitchSlider.value; });

setStatus('Ready. Upload any PDF – scanned or text – fully free.');
