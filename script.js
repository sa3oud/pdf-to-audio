// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

console.log('✅ Script loaded');

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

// Helper to show status with console log
function setStatus(msg, isError = false) {
  console.log(msg);
  statusDiv.innerHTML = msg;
  if (isError) statusDiv.style.background = '#7f1a1a';
  else statusDiv.style.background = '#0f172a';
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
  console.log('Voices loaded:', availableVoices.length);
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

// Drag & drop with debug
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
  console.log('drag over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  console.log('File dropped:', file?.name, file?.size);
  if (file && file.type === 'application/pdf') handlePDF(file);
  else setStatus('❌ Please drop a PDF file.', true);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    console.log('File selected:', e.target.files[0].name);
    handlePDF(e.target.files[0]);
  }
});

// Extract text with full error trapping
async function handlePDF(file) {
  setStatus(`📖 Processing "${file.name}" (${(file.size/1024/1024).toFixed(2)} MB)...`);
  controlsDiv.style.display = 'none';
  
  try {
    // Validate file
    if (!file || file.type !== 'application/pdf') {
      throw new Error('Not a PDF file');
    }
    
    // Read as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log('ArrayBuffer size:', arrayBuffer.byteLength);
    
    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    console.log('PDF loaded, pages:', numPages);
    
    let fullText = '';
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
      
      if (i % 10 === 0 || i === numPages) {
        setStatus(`📄 Extracted page ${i}/${numPages} (${Math.round(i/numPages*100)}%)`);
        await new Promise(r => setTimeout(r, 5)); // yield
      }
    }
    
    extractedText = fullText.trim();
    if (!extractedText) throw new Error('No text found in PDF');
    
    const wordCount = extractedText.split(/\s+/).length;
    textArea.value = extractedText;
    controlsDiv.style.display = 'block';
    setStatus(`✅ ${wordCount} words extracted from ${numPages} pages. Ready to speak.`);
    
  } catch (err) {
    console.error('PDF Error:', err);
    setStatus(`❌ Error: ${err.message || 'Unknown error'}`, true);
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
    setStatus('⚠️ No text to speak. Upload a PDF first.', true);
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
    setStatus('❌ Speech error. Try shorter text.', true);
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

setStatus('Ready. Upload a PDF file.');
console.log('Debug script ready');
