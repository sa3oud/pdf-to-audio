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

// Your live Render backend URL
const BACKEND_URL = 'https://pdf-to-audio-backend-l3o2.onrender.com/extract-text';

let extractedText = '';
let currentUtterance = null;
let availableVoices = [];

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

// Send PDF to backend
async function handlePDF(file) {
  const sizeMB = file.size / (1024 * 1024);
  setStatus(`📤 Uploading ${file.name} (${sizeMB.toFixed(1)} MB) to server...`);
  controlsDiv.style.display = 'none';
  
  const formData = new FormData();
  formData.append('pdf', file);
  
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    const data = await response.json();
    extractedText = data.text;
    textArea.value = extractedText;
    controlsDiv.style.display = 'block';
    setStatus(`✅ Extracted ${data.wordCount} words from ${data.pageCount} pages. Ready to speak.`);
    
    if (data.wordCount > 50000) {
      setStatus(`⚠️ Long document (${data.wordCount} words). Speech may be truncated.`, false);
    }
  } catch (err) {
    console.error(err);
    setStatus(`❌ Error: ${err.message}`, true);
    controlsDiv.style.display = 'none';
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
  textArea.readOnly = true;
  saveEditBtn.style.display = 'none';
  editBtn.style.display = 'inline-block';
  setStatus('✅ Text saved.');
});

// Speech
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

setStatus('Ready. Upload any PDF (no size limit, server-side processing).');
