// ============================================
//  PDF TO AUDIO - FULL ARABIC & ENGLISH SUPPORT
//  Client-side OCR with Tesseract.js
//  Supports Arabic (ara) + English (eng)
// ============================================

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
let isArabicText = false;  // Flag to detect if text contains Arabic

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

function setStatus(msg, isError = false) {
  statusDiv.innerHTML = msg;
  statusDiv.style.background = isError ? '#7f1a1a' : '#0f172a';
  console.log(msg);
}

// Simple Arabic detection (checks for Arabic Unicode range)
function containsArabic(text) {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

// Detect language and set RTL for textarea if needed
function detectAndSetLanguage(text) {
  const hasArabic = containsArabic(text);
  if (hasArabic) {
    textArea.style.direction = 'rtl';
    textArea.style.textAlign = 'right';
    isArabicText = true;
  } else {
    textArea.style.direction = 'ltr';
    textArea.style.textAlign = 'left';
    isArabicText = false;
  }
  return hasArabic;
}

// Load available voices and prioritize Arabic if needed
function loadVoices() {
  availableVoices = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  
  // Get all voices
  const allVoices = [...availableVoices];
  
  // Sort: Arabic voices first, then English
  allVoices.sort((a, b) => {
    const aIsArabic = a.lang.startsWith('ar');
    const bIsArabic = b.lang.startsWith('ar');
    if (aIsArabic && !bIsArabic) return -1;
    if (!aIsArabic && bIsArabic) return 1;
    return a.lang.localeCompare(b.lang);
  });
  
  allVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    let langName = voice.lang;
    if (voice.lang.startsWith('ar')) langName = '🇸🇦 Arabic - ' + voice.lang;
    else if (voice.lang.startsWith('en')) langName = '🇬🇧 English - ' + voice.lang;
    option.textContent = `${voice.name} (${langName})`;
    voiceSelect.appendChild(option);
  });
  
  // Try to select an Arabic voice by default if any exist
  const arabicVoice = allVoices.find(v => v.lang.startsWith('ar'));
  if (arabicVoice) {
    voiceSelect.value = arabicVoice.name;
    console.log('Default Arabic voice selected:', arabicVoice.name);
  } else if (allVoices.length > 0) {
    voiceSelect.value = allVoices[0].name;
  }
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

// Convert PDF page to image
async function pdfPageToImage(page, scale = 2) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

// OCR using Tesseract.js with Arabic + English support
async function ocrImageWithLanguages(canvas, pageNum) {
  return new Promise((resolve, reject) => {
    // Initialize Tesseract worker with Arabic and English
    Tesseract.recognize(
      canvas,
      'ara+eng',  // Arabic primary, English secondary
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            progressText.innerText = `OCR page ${pageNum}: ${Math.round(m.progress * 100)}% (Arabic + English)`;
          }
        }
      }
    ).then(({ data: { text } }) => {
      resolve(text);
    }).catch(reject);
  });
}

// Main PDF handler with Arabic OCR support
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
  
  // If little or no text, run OCR with Arabic+English
  if (fullText.trim().length < 100) {
    setStatus(`📸 Low text detected – running OCR with Arabic + English support...`);
    usedOCR = true;
    fullText = '';
    for (let i = 1; i <= numPages; i++) {
      progressText.innerText = `Converting page ${i}/${numPages} to image...`;
      const page = await pdf.getPage(i);
      const canvas = await pdfPageToImage(page);
      progressText.innerText = `OCR page ${i}/${numPages} (Arabic + English)...`;
      const ocrText = await ocrImageWithLanguages(canvas, i);
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
  const hasArabic = detectAndSetLanguage(extractedText);
  textArea.value = extractedText;
  controlsDiv.style.display = 'block';
  progressContainer.style.display = 'none';
  
  if (hasArabic) {
    setStatus(`✅ ${wordCount} words extracted${usedOCR ? ' using OCR' : ''}. Arabic detected! Ready to speak with Arabic voice.`);
  } else {
    setStatus(`✅ ${wordCount} words extracted${usedOCR ? ' using OCR' : ''}. Ready to speak.`);
  }
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
  detectAndSetLanguage(extractedText);
  textArea.readOnly = true;
  saveEditBtn.style.display = 'none';
  editBtn.style.display = 'inline-block';
  setStatus('✅ Text saved.');
});

// Speech functions with Arabic voice priority
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
  
  if (voice) {
    utterance.voice = voice;
    console.log('Using voice:', voice.name, 'Language:', voice.lang);
  } else {
    // Fallback: try to find any Arabic voice if text contains Arabic
    const hasArabic = containsArabic(extractedText);
    if (hasArabic) {
      const arabicVoice = availableVoices.find(v => v.lang.startsWith('ar'));
      if (arabicVoice) utterance.voice = arabicVoice;
    }
  }
  
  utterance.rate = parseFloat(rateSlider.value);
  utterance.pitch = parseFloat(pitchSlider.value);
  utterance.lang = containsArabic(extractedText) ? 'ar' : 'en-US';
  
  utterance.onstart = () => { 
    setStatus(`🔊 Speaking... ${utterance.lang === 'ar' ? '(Arabic voice)' : '(English voice)'}`);
    currentUtterance = utterance; 
  };
  utterance.onend = () => { 
    setStatus('✅ Finished.'); 
    currentUtterance = null; 
  };
  utterance.onerror = (err) => {
    console.error(err);
    setStatus('❌ Speech error. Try a different voice or shorter text.', true);
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

setStatus('Ready. Upload any PDF – supports Arabic and English. Best for scanned documents.');
