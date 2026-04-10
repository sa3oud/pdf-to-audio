// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

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

let extractedText = '';
let currentUtterance = null;
let availableVoices = [];

// Load voices and populate select
function loadVoices() {
  availableVoices = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  // Filter for English voices (optional)
  const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
  (englishVoices.length ? englishVoices : availableVoices).forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
  // Prefer a natural voice if available
  const preferred = availableVoices.find(v => v.name.includes('Google UK') || v.name.includes('Samantha') || v.name.includes('Microsoft'));
  if (preferred) voiceSelect.value = preferred.name;
}

// Chrome loads voices asynchronously
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

// Drag & drop handling
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
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handlePDF(e.target.files[0]);
});

// Extract text from PDF using PDF.js
async function handlePDF(file) {
  statusDiv.textContent = '📖 Reading PDF...';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }

  extractedText = fullText.trim();
  if (!extractedText) {
    statusDiv.textContent = '⚠️ No text found in PDF. Try a different file.';
    return;
  }

  textArea.value = extractedText;
  controlsDiv.style.display = 'block';
  statusDiv.textContent = `✅ Extracted ${extractedText.split(/\s+/).length} words. Ready to speak.`;
}

// Edit mode
editBtn.addEventListener('click', () => {
  textArea.readOnly = false;
  editBtn.style.display = 'none';
  saveEditBtn.style.display = 'inline-block';
  statusDiv.textContent = '✏️ Edit text as needed, then click Save.';
});

saveEditBtn.addEventListener('click', () => {
  extractedText = textArea.value;
  textArea.readOnly = true;
  saveEditBtn.style.display = 'none';
  editBtn.style.display = 'inline-block';
  statusDiv.textContent = '✅ Text saved.';
});

// Speech functions
function stopSpeaking() {
  if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
  statusDiv.textContent = '⏹️ Stopped.';
}

function speakText() {
  if (!extractedText) {
    statusDiv.textContent = '⚠️ No text to speak. Upload a PDF first.';
    return;
  }

  stopSpeaking(); // cancel any ongoing speech

  const utterance = new SpeechSynthesisUtterance(extractedText);
  // Set voice
  const selectedVoiceName = voiceSelect.value;
  const voice = availableVoices.find(v => v.name === selectedVoiceName);
  if (voice) utterance.voice = voice;

  utterance.rate = parseFloat(rateSlider.value);
  utterance.pitch = parseFloat(pitchSlider.value);

  utterance.onstart = () => {
    statusDiv.textContent = '🔊 Speaking...';
    currentUtterance = utterance;
  };
  utterance.onend = () => {
    statusDiv.textContent = '✅ Finished.';
    currentUtterance = null;
  };
  utterance.onerror = (err) => {
    console.error(err);
    statusDiv.textContent = '❌ Speech error.';
    currentUtterance = null;
  };

  window.speechSynthesis.speak(utterance);
}

function pauseSpeaking() {
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
    statusDiv.textContent = '⏸️ Paused.';
  }
}

function resumeSpeaking() {
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    statusDiv.textContent = '🔊 Speaking...';
  }
}

// Event listeners
speakBtn.addEventListener('click', speakText);
pauseBtn.addEventListener('click', pauseSpeaking);
resumeBtn.addEventListener('click', resumeSpeaking);
stopBtn.addEventListener('click', stopSpeaking);

rateSlider.addEventListener('input', () => {
  rateValue.textContent = rateSlider.value;
});
pitchSlider.addEventListener('input', () => {
  pitchValue.textContent = pitchSlider.value;
});

// Initial voice loading fallback
if (availableVoices.length === 0) {
  setTimeout(loadVoices, 200);
}
