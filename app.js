/* ================================================================
   C.A.R.E. — Fully Automatic Kiosk-Style Application
   Zero emojis · Auto voice · Multilingual · Real-time dashboard
   ================================================================ */

const APP = {
  currentScreen: 'home-screen',
  currentLang: 'auto',
  detectedLang: 'en-IN', // en-IN transcribes Hinglish naturally
  isRecording: false,
  recognition: null,
  synthesis: window.speechSynthesis,
  currentStep: 0,
  patientId: null,
  patientData: {},
  transcriptLog: [],
  intakeComplete: false,
  allPatients: [],
  selectedPatientId: null,
  broadcastChannel: null,
  autoMode: true, // fully automatic — auto-listen after each question
};

/* ── Questions (Formal but Natural) ──────────────────────── */
const STEPS = [
  {
    id: 'greeting', fieldKey: 'respondent',
    en: "Hello. I am the C.A.R.E. intake system. To begin, are you the patient or a family member?",
    hi: "नमस्ते। मैं सी.ए.आर.ई. इनटेक सिस्टम हूँ। शुरू करने के लिए, क्या आप मरीज़ हैं या उनके परिवार के सदस्य?",
    ta: "வணக்கம். நான் சி.ஏ.ஆர்.இ நுழைவு அமைப்பு. நீங்கள் நோயாளியா அல்லது குடும்ப உறுப்பினரா?",
    validate: v => v.length > 0,
  },
  {
    id: 'patient_name', fieldKey: 'name',
    en: "Please state the patient's full name.",
    hi: "कृपया मरीज़ का पूरा नाम बताएँ।",
    ta: "நோயாளியின் முழு பெயரை கூறவும்.",
    validate: v => v.length >= 2,
  },
  {
    id: 'age', fieldKey: 'age',
    en: "What is the patient's age?",
    hi: "मरीज़ की उम्र क्या है?",
    ta: "நோயாளியின் வயது என்ன?",
    validate: v => v.length > 0,
  },
  {
    id: 'gender', fieldKey: 'gender',
    en: "Please state the patient's gender.",
    hi: "कृपया मरीज़ का लिंग बताएँ। पुरुष या महिला?",
    ta: "நோயாளியின் பாலினத்தை கூறவும்.",
    validate: v => v.length > 0,
  },
  {
    id: 'complaint', fieldKey: 'complaint',
    en: "What is the primary medical complaint today? Please describe the symptoms clearly.",
    hi: "आज आपकी मुख्य मेडिकल शिकायत क्या है? कृपया लक्षणों को स्पष्ट रूप से बताएं।",
    ta: "இன்று முக்கிய மருத்துவ புகார் என்ன? தயவுசெய்து அறிகுறிகளை தெளிவாக விவரிக்கவும்.",
    validate: v => v.length >= 3,
  },
  {
    id: 'onset', fieldKey: 'onset',
    en: "When did these symptoms first begin?",
    hi: "ये लक्षण पहली बार कब शुरू हुए?",
    ta: "இந்த அறிகுறிகள் முதலில் எப்போது தொடங்கியது?",
    validate: v => v.length > 0,
  },
  {
    id: 'pain', fieldKey: 'pain',
    en: "On a scale of 1 to 10, with 10 being the most severe, how would you rate the pain?",
    hi: "1 से 10 के पैमाने पर, जहाँ 10 सबसे गंभीर दर्द है, आप दर्द को कितना रेट करेंगे?",
    ta: "1 முதல் 10 வரையிலான அளவில், வலியை எவ்வாறு மதிப்பிடுவீர்கள்?",
    validate: v => v.length > 0,
  },
  {
    id: 'history', fieldKey: 'history',
    en: "Does the patient have any pre-existing medical conditions, such as diabetes or hypertension? State 'none' if applicable.",
    hi: "क्या मरीज़ को पहले से कोई मेडिकल समस्या है, जैसे मधुमेह या रक्तचाप? यदि नहीं, तो 'कोई नहीं' कहें।",
    ta: "நோயாளிக்கு நீரிழிவு அல்லது உயர் இரத்த அழுத்தம் போன்ற முன்பே இருக்கும் மருத்துவ நிலைமைகள் ஏதேனும் உள்ளதா?",
    validate: v => v.length > 0,
  },
  {
    id: 'allergies', fieldKey: 'allergies',
    en: "Are there any known allergies to medications or food?",
    hi: "क्या दवाओं या भोजन से कोई ज्ञात एलर्जी है?",
    ta: "மருந்துகள் அல்லது உணவுக்கு ஏதேனும் அறியப்பட்ட ஒவ்வாமை உள்ளதா?",
    validate: v => v.length > 0,
  },
  {
    id: 'medications', fieldKey: 'medications',
    en: "Is the patient currently taking any daily medications?",
    hi: "क्या मरीज़ वर्तमान में कोई दैनिक दवा ले रहे हैं?",
    ta: "நோயாளி தற்போது ஏதேனும் தினசரி மருந்துகளை எடுத்துக்கொள்கிறாரா?",
    validate: v => v.length > 0,
  },
  {
    id: 'contact_name', fieldKey: 'contactName',
    en: "Please provide the name of an emergency contact.",
    hi: "कृपया एक आपातकालीन संपर्क का नाम प्रदान करें।",
    ta: "தயவுசெய்து அவசர தொடர்பு நபரின் பெயரை வழங்கவும்.",
    validate: v => v.length >= 2,
  },
  {
    id: 'contact_phone', fieldKey: 'contactPhone',
    en: "Please provide the phone number for the emergency contact.",
    hi: "कृपया आपातकालीन संपर्क के लिए फ़ोन नंबर प्रदान करें।",
    ta: "தயவுசெய்து அவசர தொடர்புக்கு தொலைபேசி எண்ணை வழங்கவும்.",
    validate: v => v.length >= 5,
  },
  {
    id: 'prescription_offer', fieldKey: 'hasPrescription',
    en: "If you have previous medical prescriptions to provide, please select 'Scan Prescription'. Otherwise, please state 'No'.",
    hi: "यदि आपके पास पिछली मेडिकल पर्ची हैं, तो कृपया 'स्कैन पर्ची' चुनें। अन्यथा, 'नहीं' कहें।",
    ta: "முந்தைய மருத்துவ மருந்துச் சீட்டுகள் உங்களிடம் இருந்தால் ஸ்கேன் செய்யவும்.",
    validate: v => v.length > 0,
  },
  {
    id: 'complete', fieldKey: null,
    en: "Intake complete. Your information has been securely transmitted to the medical staff. A doctor will attend to you shortly.",
    hi: "इनटेक पूरा हुआ। आपकी जानकारी मेडिकल स्टाफ को सुरक्षित रूप से भेज दी गई है। एक डॉक्टर जल्द ही आपकी जांच करेंगे।",
    ta: "நுழைவு முடிந்தது. உங்கள் தகவல் மருத்துவ ஊழியர்களுக்கு அனுப்பப்பட்டுள்ளது.",
    validate: () => true,
  },
];

const TOTAL_FIELDS = STEPS.filter(s => s.fieldKey && s.id !== 'complete' && s.id !== 'prescription_offer').length;

/* ── Language ─────────────────────────────────────────────── */
function detectLanguageFromText(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
  return 'en-IN';
}

function getQuestionText(step) {
  const lang = APP.detectedLang;
  if (lang.startsWith('hi') && step.hi) return step.hi;
  if (lang.startsWith('ta') && step.ta) return step.ta;
  return step.en;
}

/* ── Screen Management ────────────────────────────────────── */
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  APP.currentScreen = screenId;
  if (screenId === 'dashboard-screen') refreshDashboard();
}

function confirmExit() {
  if (APP.currentStep > 0 && !APP.intakeComplete) {
    if (!confirm('Intake is in progress. Go back? Data will be saved.')) return;
  }
  stopRecognition();
  showScreen('home-screen');
}

function startIntakeFromHome() {
  showScreen('patient-screen');
  setTimeout(() => startIntake(), 400);
}

/* ── Clock ────────────────────────────────────────────────── */
function updateClock() {
  const el = document.getElementById('home-time');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 10000);

/* ── Speech Recognition ───────────────────────────────────── */
function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Speech recognition not supported. Please use Chrome.', 'warning'); return null; }

  const rec = new SR();
  rec.continuous = true; // Prevent aggressive auto-cutoff
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.lang = APP.currentLang === 'auto' ? (APP.detectedLang || 'en-IN') : APP.currentLang;

  rec.onstart = () => { 
    APP.isRecording = true; 
    updateVoiceUI(true); 
    updateSmileyState('listening'); 
    APP.speechAccumulator = '';
    APP.currentInterim = '';
    clearTimeout(APP.silenceTimer);
  };

  rec.onresult = (event) => {
    let interim = '', newlyFinal = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) newlyFinal += t + ' '; else interim += t;
    }
    
    if (newlyFinal) {
      APP.speechAccumulator += newlyFinal;
    }
    APP.currentInterim = interim;
    
    const preview = document.getElementById('transcript-preview');
    const displayText = APP.speechAccumulator + interim;
    preview.textContent = '"' + displayText.trim() + '"';
    
    if (interim) preview.classList.add('interim');
    else preview.classList.remove('interim');

    // Reset silence timer on any speech
    clearTimeout(APP.silenceTimer);
    APP.silenceTimer = setTimeout(() => {
      // User paused for 2.5 seconds, finalize the speech
      stopRecognition();
    }, 2500);
  };

  rec.onerror = (event) => {
    if (event.error === 'no-speech') {
       // Ignore no-speech errors when continuous is true
       return;
    }
    else if (event.error === 'not-allowed') showToast('Microphone access denied. Please allow mic.', 'warning');
    APP.isRecording = false; updateVoiceUI(false); updateSmileyState('idle');
  };

  rec.onend = () => { 
    APP.isRecording = false; 
    updateVoiceUI(false); 
    updateSmileyState('idle'); 
    clearTimeout(APP.silenceTimer);
    
    const finalText = (APP.speechAccumulator + APP.currentInterim).trim();
    APP.speechAccumulator = '';
    APP.currentInterim = '';
    
    const preview = document.getElementById('transcript-preview');
    preview.classList.remove('interim');
    
    if (finalText) {
      if (APP.currentLang === 'auto') {
        const det = detectLanguageFromText(finalText);
        if (det !== APP.detectedLang) {
          APP.detectedLang = det;
          showToast('Language detected: ' + det.split('-')[0].toUpperCase(), 'info');
        }
      }
      processUserResponse(finalText);
    }
  };
  return rec;
}

function toggleVoice() {
  if (APP.intakeComplete) return;
  APP.isRecording ? stopRecognition() : startRecognition();
}

function startRecognition() {
  APP.synthesis.cancel();
  APP.recognition = initRecognition();
  if (APP.recognition) { try { APP.recognition.start(); } catch (e) {} }
}

function stopRecognition() {
  if (APP.recognition) { try { APP.recognition.stop(); } catch (e) {} }
  APP.isRecording = false; updateVoiceUI(false);
}

function updateVoiceUI(recording) {
  const btn = document.getElementById('btn-voice');
  const status = document.getElementById('voice-status');
  const statusText = document.getElementById('voice-status-text');
  if (recording) {
    btn.classList.add('recording'); status.classList.add('listening');
    statusText.textContent = 'Listening... speak now';
  } else {
    btn.classList.remove('recording'); status.classList.remove('listening');
    statusText.textContent = APP.intakeComplete ? 'Intake complete' : 'Tap the mic or start speaking';
  }
}

function updateSmileyState(state) {
  const text = document.getElementById('mini-smiley-text');
  if (!text) return;
  const msgs = { listening: 'Listening...', idle: 'Ready', speaking: 'Speaking...', thinking: 'Thinking...' };
  text.textContent = msgs[state] || 'Ready';
}

/* ── Text-to-Speech ───────────────────────────────────────── */
function speak(text, callback) {
  APP.synthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  
  // Force Hindi language if the text contains Devanagari characters
  if (/[\u0900-\u097F]/.test(text)) {
    utter.lang = 'hi-IN';
  } else {
    utter.lang = APP.detectedLang || 'en-IN';
  }
  
  utter.rate = 0.95; // Slightly slower for naturalness
  utter.pitch = 1.0;

  const voices = APP.synthesis.getVoices();
  const langPrefix = utter.lang.split('-')[0];
  
  const matching = voices.filter(v => v.lang.startsWith(langPrefix) || v.lang.startsWith(utter.lang));
  
  // Prioritize known high-quality neural female voices
  const premiumFemale = ['Google हिन्दी', 'Microsoft Swara Online', 'Microsoft Swara', 'Google UK English Female', 'Microsoft Zira', 'Aditi', 'Microsoft Kalpana'];
  let selectedVoice = null;
  
  for (const name of premiumFemale) {
    const found = matching.find(v => v.name.includes(name));
    if (found) { selectedVoice = found; break; }
  }
  
  if (!selectedVoice) selectedVoice = matching.find(v => v.name.toLowerCase().includes('female'));
  if (!selectedVoice && matching.length > 0) selectedVoice = matching.find(v => !v.name.toLowerCase().includes('male')) || matching[0];

  if (selectedVoice) utter.voice = selectedVoice;

  updateSmileyState('speaking');

  utter.onend = () => {
    updateSmileyState('idle');
    if (callback) callback();
    // AUTO-LISTEN after bot finishes speaking
    if (APP.autoMode && !APP.intakeComplete && APP.currentStep < STEPS.length) {
      setTimeout(() => startRecognition(), 600);
    }
  };

  APP.synthesis.speak(utter);
}

/* ── LLM Integration & System Prompt ──────────────────────── */
const SYSTEM_PROMPT = `You are C.A.R.E., a very friendly, empathetic, and human-like hospital triage assistant.
Speak in a casual, conversational, and caring tone. Do NOT sound like a robot, machine, or formal system. Avoid words like "system", "input", "database", or "processing". Speak to the patient exactly like a kind nurse would. Keep your sentences short and natural.
Your goal is to collect this information: Respondent (Patient or Family), Patient Name, Age, Gender, Chief Complaint, Symptom Onset, Pain Level (1-10), Medical History, Allergies, Current Medications, Emergency Contact Name & Phone.

CRITICAL RULES:
1. Ask ONE logical question at a time. Do not overwhelm the patient.
2. Formulate your questions based on what the patient just said. Show empathy.
3. CRITICAL LANGUAGE RULE: You MUST reply in the EXACT SAME LANGUAGE and SCRIPT the user speaks to you.
   - If the user speaks English, reply in English.
   - If the user speaks Hindi, YOU MUST REPLY IN ROMAN HINDI (Hinglish alphabet, e.g. "Aapka naam kya hai?"). DO NOT use Devanagari script!
   - We need Roman Hindi because our voice engine reads it much more fluently and naturally than Devanagari.
   - Note: The speech-to-text might mistranscribe Hindi words as English (e.g. "main patient" -> "my patient"). Use context to deduce their actual intent.
4. Output your response STRICTLY as a valid JSON object matching this structure exactly (no markdown formatting, just JSON):
{
  "replyText": "Your spoken reply to the patient here in their exact language",
  "extractedData": {
    "respondent": "", "name": "", "age": "", "gender": "", "complaint": "", "onset": "", "pain": "", "history": "", "allergies": "", "medications": "", "contactName": "", "contactPhone": ""
  },
  "isComplete": false
}`;

/* ── Intake Flow ──────────────────────────────────────────── */
function startIntake() {
  APP.currentStep = 0;
  APP.patientId = 'PT-' + Date.now().toString(36).toUpperCase();
  APP.patientData = { id: APP.patientId, timestamp: new Date().toISOString(), status: 'in-progress' };
  APP.transcriptLog = [];
  APP.chatHistory = [];
  APP.intakeComplete = false;

  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('transcript-preview').textContent = '';
  addChatBubble('system', 'Intake started — ID: ' + APP.patientId);

  syncToDashboard();
  
  const apiKey = localStorage.getItem('care-groq-key');
  if (apiKey) {
    // LLM Mode
    APP.llmMode = true;
    setTimeout(() => askLLM("Hello. I am the C.A.R.E. system. Start the conversation by asking if I am the patient or family."), 600);
  } else {
    // Fallback Hardcoded Mode
    APP.llmMode = false;
    showToast('Demo Mode: Using hardcoded script. Add Groq API Key for dynamic AI conversation.', 'warning');
    setTimeout(() => askCurrentQuestion(), 600);
  }
}

function askCurrentQuestion() {
  if (APP.currentStep >= STEPS.length) return;
  const step = STEPS[APP.currentStep];
  const text = getQuestionText(step);

  addChatBubble('bot', text);
  speak(text);

  if (step.id === 'complete') {
    APP.intakeComplete = true;
    APP.patientData.status = 'complete';
    updateVoiceUI(false);
    syncToDashboard();
    addChatBubble('system', 'Intake complete — data sent to medical team');
  }
}

async function askLLM(userInput) {
  const apiKey = localStorage.getItem('care-groq-key');
  if (!apiKey) return;
  
  updateSmileyState('thinking');
  document.getElementById('voice-status-text').textContent = 'AI is thinking...';
  
  try {
    APP.chatHistory.push({ role: "user", content: userInput });
    
    if (!APP.groqTextModel) {
      const modelRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      const modelData = await modelRes.json();
      if (!modelData.data) throw new Error("Could not fetch Groq models.");
      const validModels = modelData.data.filter(m => 
        !m.id.includes('vision') && 
        !m.id.includes('guard') && 
        !m.id.includes('whisper') && 
        !m.id.includes('tts')
      );
      if (validModels.length === 0) throw new Error("No compatible chat models found on this key.");
      
      const preferred = validModels.find(m => m.id.toLowerCase().includes('qwen')) ||
                        validModels.find(m => m.id.toLowerCase().includes('mixtral')) ||
                        validModels[0];
      APP.groqTextModel = preferred.id;
    }

    const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ 
        model: APP.groqTextModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...APP.chatHistory
        ]
      })
    });
    
    const resData = await response.json();
    if (resData.error) throw new Error(resData.error.message);
    
    const rawText = resData.choices[0].message.content;
    APP.chatHistory.push({ role: "assistant", content: rawText });
    
    // Parse JSON from LLM
    let parsed = null;
    try {
      const jsonStart = rawText.indexOf('{');
      const jsonEnd = rawText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const cleanJson = rawText.substring(jsonStart, jsonEnd + 1);
        parsed = JSON.parse(cleanJson);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (e) {
      console.error("LLM JSON Parse Error:", e, rawText);
      // Fallback if LLM output invalid JSON (e.g., unescaped quotes)
      let fallbackText = rawText.replace(/```json/g, '').replace(/```/g, '');
      if (fallbackText.includes('"replyText"')) {
         fallbackText = fallbackText.replace(/[\s\S]*?"replyText"\s*:\s*"/, '');
         fallbackText = fallbackText.replace(/",\s*"extractedData"[\s\S]*/, '');
         fallbackText = fallbackText.replace(/",\s*"isComplete"[\s\S]*/, '');
         if (fallbackText.endsWith('"}')) fallbackText = fallbackText.slice(0, -2);
         if (fallbackText.endsWith('" }')) fallbackText = fallbackText.slice(0, -3);
         fallbackText = fallbackText.trim();
      }
      parsed = { replyText: fallbackText, extractedData: {}, isComplete: false };
    }
    
    // Fallback if replyText is missing
    const reply = parsed.replyText || parsed.reply || parsed.response || parsed.text || parsed.message || "Processing...";
    
    // Auto-detect language from LLM's response to adjust microphone for next turn
    if (APP.currentLang === 'auto') {
      if (/[\u0900-\u097F]/.test(reply)) {
        APP.detectedLang = 'hi-IN';
      }
      // Removed the auto-switch to en-IN because hi-IN is much better for transcribing Hinglish
    }
    
    // Update Dashboard Data
    if (parsed.extractedData) {
      Object.keys(parsed.extractedData).forEach(k => {
        if (parsed.extractedData[k]) APP.patientData[k] = parsed.extractedData[k];
      });
      syncToDashboard();
    }
    
    addChatBubble('bot', reply);
    speak(reply, () => {
      if (parsed.isComplete) {
        APP.intakeComplete = true;
        APP.patientData.status = 'complete';
        updateVoiceUI(false);
        syncToDashboard();
        addChatBubble('system', 'Intake complete — data sent to medical team');
      }
    });
    
  } catch (err) {
    console.error('LLM Error:', err);
    showToast('AI connection failed: ' + err.message, 'warning');
    APP.llmMode = false;
    updateSmileyState('idle');
    document.getElementById('voice-status-text').textContent = 'Tap the mic or start speaking';
    askCurrentQuestion();
  }
}

function processUserResponse(text) {
  if (APP.intakeComplete) return;
  const trimmed = text.trim();
  if (!trimmed) return;

  addChatBubble('user', trimmed);
  APP.transcriptLog.push({
    question: "...", // Simplified for LLM mode
    answer: trimmed, timestamp: new Date().toISOString(), lang: APP.detectedLang,
  });

  if (APP.llmMode) {
    askLLM(trimmed);
  } else {
    // Hardcoded Fallback
    const step = STEPS[APP.currentStep];
    APP.transcriptLog[APP.transcriptLog.length - 1].question = getQuestionText(step);
    APP.transcriptLog[APP.transcriptLog.length - 1].step = step.id;
    if (step.fieldKey) APP.patientData[step.fieldKey] = trimmed;
    syncToDashboard();
    APP.currentStep++;
    setTimeout(() => askCurrentQuestion(), 700);
  }
}

function skipQuestion() {
  if (APP.intakeComplete) return;
  stopRecognition();
  
  if (APP.llmMode) {
    addChatBubble('system', 'Question skipped');
    askLLM("(User chose to skip this question. Do not ask it again. Move to the next most logical missing field.)");
    return;
  }

  if (APP.currentStep >= STEPS.length) return;
  const step = STEPS[APP.currentStep];
  if (step.fieldKey) APP.patientData[step.fieldKey] = '(Skipped)';
  addChatBubble('system', 'Question skipped');
  APP.transcriptLog.push({
    step: step.id, question: getQuestionText(step),
    answer: '(Skipped)', timestamp: new Date().toISOString(), lang: APP.detectedLang,
  });

  APP.currentStep++;
  syncToDashboard();
  setTimeout(() => askCurrentQuestion(), 400);
}

function submitTextInput() {
  const input = document.getElementById('text-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  if (APP.currentLang === 'auto') {
    const det = detectLanguageFromText(text);
    if (det !== APP.detectedLang) APP.detectedLang = det;
  }
  processUserResponse(text);
}

/* ── Chat Bubbles ─────────────────────────────────────────── */
function addChatBubble(type, text) {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bubble--' + type;

  if (type === 'bot') {
    bubble.innerHTML = '<div class="bubble-sender">C.A.R.E. Assistant</div><div class="bubble-text">' + escapeHtml(text) + '</div>';
  } else if (type === 'user') {
    bubble.innerHTML = '<div class="bubble-text">' + escapeHtml(text) + '</div>';
  } else if (type === 'system') {
    bubble.innerHTML = '<span>' + escapeHtml(text) + '</span>';
  } else if (type === 'scan') {
    bubble.className = 'chat-bubble chat-bubble--bot';
    bubble.innerHTML = '<div class="bubble-sender">Scan Result</div><div class="bubble-text">' + text + '</div>';
  }

  container.appendChild(bubble);
  document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

/* ── Language Selection ───────────────────────────────────── */
function setLanguage(lang) {
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  if (lang === 'auto') {
    APP.currentLang = 'auto';
    document.getElementById('lang-auto').classList.add('active');
    showToast('Auto language detection enabled', 'info');
  } else {
    APP.currentLang = lang;
    APP.detectedLang = lang;
    const btn = document.getElementById('lang-' + lang.split('-')[0]);
    if (btn) btn.classList.add('active');
    showToast('Language set to ' + lang, 'info');
  }
}

/* ── Prescription Scanner ─────────────────────────────────── */
function openScanner(mode = 'intake') { 
  APP.scannerMode = mode;
  document.getElementById('scan-modal').classList.remove('hidden'); 
  document.getElementById('scan-upload-area').classList.remove('hidden'); 
  document.getElementById('scan-preview-area').classList.add('hidden'); 
  const btn = document.getElementById('scan-accept-btn');
  if (btn) btn.textContent = mode === 'quick' ? 'Close Scanner' : 'Add to Record';
}
function closeScanner() { document.getElementById('scan-modal').classList.add('hidden'); }

function handleScanFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { showScanPreview(e.target.result); runOCR(e.target.result); };
  reader.readAsDataURL(file);
}

function showScanPreview(src) {
  document.getElementById('scan-upload-area').classList.add('hidden');
  document.getElementById('scan-preview-area').classList.remove('hidden');
  document.getElementById('scan-preview-img').src = src;
  document.getElementById('scan-processing').classList.remove('hidden');
  document.getElementById('scan-results').classList.add('hidden');
  document.getElementById('scan-raw-text').classList.add('hidden');
}

async function runOCR(imageSrc) {
  const progressText = document.getElementById('scan-progress-text');
  const progressFill = document.getElementById('scan-progress-fill');
  
  const ocrSpaceKey = localStorage.getItem('care-ocrspace-key');
  const groqKey = localStorage.getItem('care-groq-key');
  
  if (ocrSpaceKey) {
    progressText.textContent = 'Scanning with OCR.space (Handwriting Engine)...'; 
    progressFill.style.width = '40%';
    try {
      const formData = new FormData();
      formData.append('base64Image', imageSrc);
      formData.append('language', 'hin');
      formData.append('OCREngine', '3');
      formData.append('isTable', 'true');
      formData.append('scale', 'true');
      
      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'apikey': ocrSpaceKey
        },
        body: formData
      });
      
      progressFill.style.width = '80%';
      const resData = await response.json();
      
      if (resData.IsErroredOnProcessing) {
        throw new Error(resData.ErrorMessage || 'OCR processing failed');
      }
      
      if (!resData.ParsedResults || resData.ParsedResults.length === 0) {
        throw new Error('No text found in image');
      }
      
      progressFill.style.width = '100%'; 
      progressText.textContent = 'Analysis Complete!';
      
      const extractedText = resData.ParsedResults.map(r => r.ParsedText).join('\n');
      setTimeout(() => displayScanResults({ text: extractedText, confidence: 95 }), 300);
      return;
    } catch (err) {
      console.error("OCR.space Error:", err);
      progressText.textContent = 'OCR.space failed (' + err.message + '). Trying Tesseract...';
      showToast('OCR.space Error: ' + err.message, 'error');
      setTimeout(() => runTesseract(imageSrc), 1500);
      return;
    }
  }
  
  if (geminiKey) {
    progressText.textContent = 'Analyzing image with Google Gemini 1.5 Flash...'; 
    progressFill.style.width = '50%';
    try {
      const base64Image = imageSrc.split(',')[1];
      const mimeType = imageSrc.split(';')[0].split(':')[1];
      
      const payload = {
        contents: [{
          parts: [
            { text: "Extract the text from this image exactly as written. If it is a medical prescription, transcribe the doctor's handwriting (medicines, dosages, doctor names, dates). If it is a table or list (e.g. List of Students), format it cleanly as a text table or list." },
            { inlineData: { mimeType: mimeType, data: base64Image } }
          ]
        }]
      };
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error.message);
      
      progressFill.style.width = '100%'; 
      progressText.textContent = 'Analysis Complete!';
      
      const extractedText = data.candidates[0].content.parts[0].text;
      setTimeout(() => displayScanResults({ text: extractedText, confidence: 99 }), 300);
      return;
    } catch (err) {
      console.error("Gemini Vision Error:", err);
      progressText.textContent = 'Gemini Vision failed (' + err.message + '). Trying local AI...';
      showToast('Gemini API Error: ' + err.message, 'error');
      setTimeout(() => runLocalTransformersOCR(imageSrc), 1500);
      return;
    }
  }
  
  if (groqKey) {
    progressText.textContent = 'Analyzing handwriting with Groq (Llama Vision)...'; 
    progressFill.style.width = '50%';
    try {
      const base64Image = imageSrc.split(',')[1];
      
      if (!APP.groqVisionModel) {
        const modelRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${groqKey}` }
        });
        const modelData = await modelRes.json();
        
        if (modelData.error) {
           throw new Error(modelData.error.message); // Show exact Groq error!
        }
        
        const validModels = modelData.data ? modelData.data.filter(m => m.id.includes('vision')) : [];
        if (validModels.length > 0) {
           APP.groqVisionModel = validModels[0].id;
        } else {
           // Fallback to known stable ID if /models endpoint doesn't list it
           APP.groqVisionModel = 'llama-3.2-11b-vision-preview'; 
        }
      }

      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: APP.groqVisionModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extract the text from this medical prescription. Please accurately transcribe the doctor's handwriting. If there are medicines, dosages, doctor names, or dates, capture them clearly. If it's a table, format it clearly." },
                { type: "image_url", image_url: { url: imageSrc } }
              ]
            }
          ]
        })
      });
      
      const resData = await response.json();
      if (resData.error) throw new Error(resData.error.message);
      
      progressFill.style.width = '100%'; 
      progressText.textContent = 'Analysis Complete!';
      
      const extractedText = resData.choices[0].message.content;
      setTimeout(() => displayScanResults({ text: extractedText, confidence: 95 }), 300);
      
    } catch (err) {
      console.error("Groq Vision Error:", err);
      progressText.textContent = 'AI Vision failed (' + err.message + '). Trying local AI...';
      showToast('Vision API Error: ' + err.message, 'error');
      setTimeout(() => runLocalTransformersOCR(imageSrc), 1500);
    }
  } else {
    runLocalTransformersOCR(imageSrc);
  }
}

// ----------------------------------------------------
// LOCAL AI OCR (Transformers.js + TrOCR)
// ----------------------------------------------------
async function runLocalTransformersOCR(imageSrc) {
  try {
    const progressText = document.getElementById('scanner-progress-text');
    const progressFill = document.getElementById('scanner-progress-fill');
    
    progressText.textContent = 'Starting Local AI (TrOCR)...';
    progressFill.style.width = '10%';
    
    // Dynamically import Transformers.js
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0');
    
    // Disable local models to fetch from HF Hub
    env.allowLocalModels = false;

    progressText.textContent = 'Loading AI Model (~240MB, once only)...';
    
    const recognizer = await pipeline('image-to-text', 'Xenova/trocr-small-handwritten', {
      progress_callback: (x) => {
        if (x.status === 'progress' || x.status === 'downloading') {
           const percent = Math.round((x.loaded / x.total) * 100);
           progressText.textContent = `Downloading Local AI: ${percent}%`;
           progressFill.style.width = `${percent}%`;
        } else if (x.status === 'done') {
           progressText.textContent = 'Model loaded. Analyzing handwriting...';
           progressFill.style.width = '80%';
        }
      }
    });

    progressText.textContent = 'Analyzing handwriting locally (may take a few seconds)...';
    
    const result = await recognizer(imageSrc);
    const extractedText = result[0].generated_text;
    
    progressText.textContent = 'Analysis Complete!';
    progressFill.style.width = '100%';
    
    setTimeout(() => displayScanResults({ text: extractedText, confidence: 95 }), 500);
  } catch (err) {
    console.error("Local AI Error:", err);
    document.getElementById('scanner-progress-text').textContent = 'Local AI failed. Falling back to Tesseract...';
    setTimeout(() => runTesseract(imageSrc), 1500);
  }
}

function runDemoScan(progressFill, progressText) {
  progressText.textContent = 'Simulating AI Vision (Demo Mode)...'; 
  progressFill.style.width = '50%';
  setTimeout(() => {
    progressFill.style.width = '100%';
    progressText.textContent = 'Analysis Complete!';
    
    const fakeText = "Dr. Sharma Clinic\nRx\n1. Tab Paracetamol 500mg 1-0-1\n2. Cap Amoxicillin 250mg 1-1-1 for 5 Days\n3. Syr Coughfix 10ml bd\nAdv: Drink warm water, strict bed rest.";
    displayScanResults({ text: fakeText, confidence: 99 });
    
    showToast('Used Mock AI Data. (No valid API Key)', 'info');
  }, 1500);
}

/* We keep Tesseract around just in case, but unused for Demo */
async function runTesseract(imageSrc) {
  const progressText = document.getElementById('scan-progress-text');
  const progressFill = document.getElementById('scan-progress-fill');
  try {
    progressText.textContent = 'Loading OCR engine...'; progressFill.style.width = '10%';
    const result = await Tesseract.recognize(imageSrc, 'eng+hin', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          progressText.textContent = 'Recognizing text... ' + pct + '%';
          progressFill.style.width = (10 + pct * 0.85) + '%';
        } else { progressText.textContent = m.status || 'Processing...'; }
      }
    });
    progressFill.style.width = '100%'; progressText.textContent = 'Done!';
    setTimeout(() => displayScanResults(result.data), 300);
  } catch (err) {
    progressText.textContent = 'Error: ' + err.message;
    showToast('OCR failed. Try a clearer image.', 'error');
  }
}

function displayScanResults(data) {
  document.getElementById('scan-processing').classList.add('hidden');
  document.getElementById('scan-results').classList.remove('hidden');
  document.getElementById('scan-raw-text').classList.remove('hidden');

  const rawText = data.text || '';
  document.getElementById('scan-raw-content').textContent = rawText;

  const parsed = parsePrescription(rawText);
  const div = document.getElementById('scan-results-content');
  let html = '';

  if (parsed.medicines.length > 0) html += '<div class="scan-result-section"><strong>Medicines Found:</strong><ul>' + parsed.medicines.map(m => '<li>' + escapeHtml(m) + '</li>').join('') + '</ul></div>';
  if (parsed.dosages.length > 0) html += '<div class="scan-result-section"><strong>Dosage Instructions:</strong><ul>' + parsed.dosages.map(d => '<li>' + escapeHtml(d) + '</li>').join('') + '</ul></div>';
  if (parsed.doctor) html += '<div class="scan-result-section"><strong>Doctor:</strong> ' + escapeHtml(parsed.doctor) + '</div>';
  if (parsed.date) html += '<div class="scan-result-section"><strong>Date:</strong> ' + escapeHtml(parsed.date) + '</div>';

  html += '<div class="scan-result-section scan-confidence"><strong>Confidence:</strong> ' + Math.round(data.confidence || 0) + '% <span class="confidence-note">(' + (data.confidence > 70 ? 'Good readability' : 'Low readability') + ')</span></div>';

  if (!parsed.medicines.length && !parsed.doctor) {
    html += '<div class="scan-result-section"><strong>Extracted Text:</strong><p class="scan-extracted-text">' + escapeHtml(rawText.substring(0, 500)) + '</p></div>';
  }
  div.innerHTML = html;
}

function parsePrescription(text) {
  const result = { medicines: [], dosages: [], doctor: null, date: null };
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
  const medKW = ['tab','tablet','cap','capsule','syrup','syr','inj','injection','ointment','cream','drops','gel','mg','ml','paracetamol','crocin','dolo','azithromycin','amoxicillin','cetirizine','omeprazole','pantoprazole','metformin','atorvastatin','amlodipine','ibuprofen','diclofenac','montelukast'];
  const dosePat = /\b(\d+[-–]\d+[-–]\d+|once|twice|thrice|daily|morning|night|before|after|meal|bd|tds|od|hs|stat)\b/gi;
  const datePat = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/;
  const docPat = /(?:dr\.?|doctor)\s+([a-zA-Z\s]+)/i;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const hasMed = medKW.some(kw => lower.includes(kw));
    if (hasMed) result.medicines.push(line);
    const dosage = line.match(dosePat);
    if (dosage && !hasMed) result.dosages.push(line);
    if (!result.doctor) { const doc = line.match(docPat); if (doc) result.doctor = doc[0]; }
    if (!result.date) { const dt = line.match(datePat); if (dt) result.date = dt[1]; }
  }
  return result;
}

function acceptScanResults() {
  if (APP.scannerMode === 'quick') {
    closeScanner();
    return;
  }
  
  const rawText = document.getElementById('scan-raw-content').textContent;
  const parsed = parsePrescription(rawText);
  if (!APP.patientData) APP.patientData = {};
  APP.patientData.prescriptionText = rawText;
  APP.patientData.prescriptionMedicines = parsed.medicines;
  APP.patientData.prescriptionDoctor = parsed.doctor;

  let parts = [];
  if (parsed.medicines.length) parts.push('<strong>Medicines:</strong> ' + parsed.medicines.join(', '));
  if (parsed.doctor) parts.push('<strong>Doctor:</strong> ' + parsed.doctor);
  addChatBubble('scan', parts.length > 0 ? parts.join('<br>') : 'Prescription text captured (' + rawText.length + ' chars)');

  syncToDashboard(); closeScanner();
  showToast('Prescription added to patient record', 'success');
}

function retryScan() {
  document.getElementById('scan-upload-area').classList.remove('hidden');
  document.getElementById('scan-preview-area').classList.add('hidden');
  document.getElementById('scan-camera-input').value = '';
  document.getElementById('scan-file-input').value = '';
}

/* ── Dashboard Sync ───────────────────────────────────────── */
function initBroadcast() {
  try {
    APP.broadcastChannel = new BroadcastChannel('care-intake');
    APP.broadcastChannel.onmessage = (e) => { 
      if (e.data.type === 'patient-update') handlePatientUpdate(e.data.patient); 
      if (e.data.type === 'patient-delete') refreshDashboard();
    };
  } catch (e) {
    window.addEventListener('storage', (e) => { if (e.key === 'care-patients') refreshDashboard(); });
  }
}

function syncToDashboard() {
  const snap = {
    ...APP.patientData,
    transcriptLog: [...APP.transcriptLog],
    progress: Math.round((Object.keys(APP.patientData).filter(k => !['id','timestamp','status'].includes(k) && !k.startsWith('prescription') && APP.patientData[k] && APP.patientData[k] !== '(Skipped)').length / TOTAL_FIELDS) * 100),
  };
  let patients = JSON.parse(localStorage.getItem('care-patients') || '[]');
  const idx = patients.findIndex(p => p.id === snap.id);
  if (idx >= 0) patients[idx] = snap; else patients.unshift(snap);
  localStorage.setItem('care-patients', JSON.stringify(patients));
  if (APP.broadcastChannel) { try { APP.broadcastChannel.postMessage({ type: 'patient-update', patient: snap }); } catch (e) {} }
  APP.allPatients = patients;
}

function handlePatientUpdate(patient) {
  let patients = JSON.parse(localStorage.getItem('care-patients') || '[]');
  const idx = patients.findIndex(p => p.id === patient.id);
  if (idx >= 0) patients[idx] = patient; else patients.unshift(patient);
  APP.allPatients = patients;
  localStorage.setItem('care-patients', JSON.stringify(patients));
  refreshDashboard();
}

function refreshDashboard() {
  const patients = JSON.parse(localStorage.getItem('care-patients') || '[]');
  APP.allPatients = patients;
  const listEl = document.getElementById('patient-list');
  const emptyEl = document.getElementById('empty-patient-list');

  if (patients.length === 0) { emptyEl.style.display = ''; return; }
  emptyEl.style.display = 'none';

  const existing = new Set();
  listEl.querySelectorAll('.patient-card').forEach(c => existing.add(c.dataset.patientId));

  for (const p of patients) {
    if (!existing.has(p.id)) listEl.insertBefore(createPatientCard(p), listEl.firstChild);
    else updatePatientCard(p);
  }

  if (!APP.selectedPatientId && patients.length > 0) selectPatient(patients[0].id);
  else if (APP.selectedPatientId) { const sel = patients.find(p => p.id === APP.selectedPatientId); if (sel) updateDetailView(sel); }
}

function createPatientCard(p) {
  const card = document.createElement('div');
  card.className = 'patient-card'; card.dataset.patientId = p.id;
  card.onclick = () => selectPatient(p.id);
  const init = (p.name || '?').substring(0, 2).toUpperCase();
  const time = new Date(p.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const sc = p.status === 'complete' ? 'complete' : 'in-progress';
  card.innerHTML = '<div class="patient-card-header"><div class="patient-card-avatar">' + init + '</div><div><div class="patient-card-name">' + escapeHtml(p.name || 'Unknown') + '</div><div class="patient-card-time">' + time + ' · ' + p.id + '</div></div></div><div class="patient-card-status ' + sc + '">' + (p.status === 'complete' ? 'Complete' : 'In Progress') + '</div>';
  return card;
}

function updatePatientCard(p) {
  const card = document.querySelector('.patient-card[data-patient-id="' + p.id + '"]');
  if (!card) return;
  const n = card.querySelector('.patient-card-name'); if (n) n.textContent = p.name || 'Unknown';
  const a = card.querySelector('.patient-card-avatar'); if (a) a.textContent = (p.name || '?').substring(0, 2).toUpperCase();
  const s = card.querySelector('.patient-card-status');
  if (s) { s.className = 'patient-card-status ' + (p.status === 'complete' ? 'complete' : 'in-progress'); s.textContent = p.status === 'complete' ? 'Complete' : 'In Progress'; }
}

function selectPatient(id) {
  APP.selectedPatientId = id;
  document.querySelectorAll('.patient-card').forEach(c => c.classList.remove('active'));
  const card = document.querySelector('.patient-card[data-patient-id="' + id + '"]');
  if (card) card.classList.add('active');
  document.getElementById('dash-detail-empty').classList.add('hidden');
  document.getElementById('dash-detail').classList.remove('hidden');
  const p = APP.allPatients.find(x => x.id === id);
  if (p) updateDetailView(p);
}

function updateDetailView(p) {
  document.getElementById('detail-avatar').textContent = (p.name || '?').substring(0, 2).toUpperCase();
  document.getElementById('detail-name').textContent = p.name || 'Unknown Patient';
  document.getElementById('detail-age').textContent = p.age ? 'Age: ' + p.age : 'Age: —';
  document.getElementById('detail-gender').textContent = p.gender || 'Gender: —';
  document.getElementById('detail-time').textContent = new Date(p.timestamp).toLocaleString('en-IN');
  
  // Dashboard inputs
  document.getElementById('assign-doctor').value = p.assignedDoctor || '';
  document.getElementById('assign-room').value = p.assignedRoom || '';

  const pr = document.getElementById('detail-priority');
  if (p.status === 'complete') { pr.textContent = 'COMPLETE'; pr.className = 'detail-priority complete'; }
  else { pr.textContent = 'INTAKE IN PROGRESS'; pr.className = 'detail-priority'; }

  setField('val-complaint', p.complaint);
  setField('val-onset', p.onset);
  setField('val-pain', p.pain ? formatPain(p.pain) : null);
  setField('val-history', p.history);
  setField('val-allergies', p.allergies);
  setField('val-medications', p.medications);
  setField('val-contact', [p.contactName, p.contactPhone].filter(Boolean).join(' — ') || null);
  setField('val-relation', p.respondent);

  const pc = document.getElementById('card-prescription');
  const pv = document.getElementById('val-prescription');
  if (p.prescriptionText || (p.prescriptionMedicines && p.prescriptionMedicines.length)) {
    pc.style.display = '';
    let h = '';
    if (p.prescriptionMedicines && p.prescriptionMedicines.length) h += '<strong>Medicines:</strong><br>' + p.prescriptionMedicines.map(m => '· ' + escapeHtml(m)).join('<br>');
    if (p.prescriptionDoctor) h += '<br><strong>Doctor:</strong> ' + escapeHtml(p.prescriptionDoctor);
    if (p.prescriptionText && !p.prescriptionMedicines?.length) h += escapeHtml(p.prescriptionText.substring(0, 300));
    pv.innerHTML = h;
    flashCard('card-prescription');
  }

  const tEl = document.getElementById('val-transcript');
  if (p.transcriptLog && p.transcriptLog.length > 0) {
    tEl.innerHTML = p.transcriptLog.map(e => {
      const t = new Date(e.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return '<div class="transcript-entry"><span class="transcript-time">[' + t + ']</span><span class="transcript-q">Q: ' + escapeHtml((e.question || '').substring(0, 60)) + '...</span><span class="transcript-a">A: <strong>' + escapeHtml(e.answer) + '</strong></span>' + (e.lang !== 'en-IN' ? '<span class="transcript-lang">' + e.lang + '</span>' : '') + '</div>';
    }).join('');
  }

  const prog = p.progress || 0;
  document.getElementById('progress-pct').textContent = Math.min(prog, 100) + '%';
  document.getElementById('progress-fill').style.width = Math.min(prog, 100) + '%';
}

function setField(id, value) {
  const el = document.getElementById(id); if (!el) return;
  const nv = value || 'Awaiting...';
  if (el.textContent !== nv) {
    el.textContent = nv;
    if (value && value !== 'Awaiting...' && value !== '(Skipped)') { const c = el.closest('.detail-card'); if (c) flashCard(c.id); }
  }
}

function flashCard(id) { const c = document.getElementById(id); if (!c) return; c.classList.remove('updated'); void c.offsetWidth; c.classList.add('updated'); }

function formatPain(t) {
  const n = parseInt(t); if (isNaN(n)) return t;
  const bars = '\u2588'.repeat(n) + '\u2591'.repeat(10 - Math.min(n, 10));
  let sev = 'Mild'; if (n >= 7) sev = 'Severe'; else if (n >= 4) sev = 'Moderate';
  return n + '/10  ' + bars + '  ' + sev;
}

function saveStaffAssignments() {
  if (!APP.selectedPatientId) return;
  let patients = JSON.parse(localStorage.getItem('care-patients') || '[]');
  const p = patients.find(x => x.id === APP.selectedPatientId);
  if (p) {
    p.assignedDoctor = document.getElementById('assign-doctor').value;
    p.assignedRoom = document.getElementById('assign-room').value;
    
    // update state
    APP.allPatients = patients;
    localStorage.setItem('care-patients', JSON.stringify(patients));
    if (APP.broadcastChannel) { try { APP.broadcastChannel.postMessage({ type: 'patient-update', patient: p }); } catch (e) {} }
    
    showToast('Patient assignment updated successfully', 'success');
  }
}

function deletePatientRecord() {
  if (!APP.selectedPatientId) return;
  if (!confirm("Are you sure you want to permanently delete this patient record?")) return;
  
  let patients = JSON.parse(localStorage.getItem('care-patients') || '[]');
  patients = patients.filter(p => p.id !== APP.selectedPatientId);
  
  APP.allPatients = patients;
  localStorage.setItem('care-patients', JSON.stringify(patients));
  
  APP.selectedPatientId = null;
  refreshDashboard();
  
  if (APP.broadcastChannel) { 
    try { APP.broadcastChannel.postMessage({ type: 'patient-delete' }); } catch (e) {} 
  }
  
  showToast('Patient record deleted', 'success');
}

/* ── Toasts ───────────────────────────────────────────────── */
function showToast(msg, type) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast toast--' + (type || 'info');
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--show'));
  setTimeout(() => { t.classList.remove('toast--show'); setTimeout(() => t.remove(), 300); }, 3500);
}

/* ── AI Settings ──────────────────────────────────────────── */
function openAISettings() {
  document.getElementById('ai-settings-modal').classList.remove('hidden');
  document.getElementById('groq-api-key').value = localStorage.getItem('care-groq-key') || '';
  document.getElementById('ocrspace-api-key').value = localStorage.getItem('care-ocrspace-key') || '';
}

function closeAISettings() {
  document.getElementById('ai-settings-modal').classList.add('hidden');
}

function saveAISettings() {
  const groqKey = document.getElementById('groq-api-key').value.trim();
  const ocrSpaceKey = document.getElementById('ocrspace-api-key').value.trim();
  
  if (groqKey) {
    if (!groqKey.startsWith('gsk_')) {
      showToast('Invalid Groq key! It must start with gsk_', 'error');
    } else {
      localStorage.setItem('care-groq-key', groqKey);
      showToast('Groq API Key saved successfully!', 'success');
    }
  } else {
    localStorage.removeItem('care-groq-key');
  }
  
  if (ocrSpaceKey) {
    localStorage.setItem('care-ocrspace-key', ocrSpaceKey);
    showToast('OCR.space API Key saved successfully!', 'success');
  } else {
    localStorage.removeItem('care-ocrspace-key');
  }
  
  closeAISettings();
}

/* ── Login Modal Logic ────────────────────────────────────── */
let pendingAuthAction = '';

function openLogin(action) {
  pendingAuthAction = action;
  document.getElementById('login-modal').classList.remove('hidden');
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-pass').value = '';
}

function closeLogin() {
  document.getElementById('login-modal').classList.add('hidden');
}

function verifyLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  if (user === 'admin' && pass === 'care2026') {
    closeLogin();
    if (pendingAuthAction === 'dashboard') {
      showScreen('dashboard-screen');
    } else if (pendingAuthAction === 'settings') {
      openAISettings();
    }
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

/* ── Keyboard ─────────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement.id === 'text-input') { e.preventDefault(); submitTextInput(); }
  if (e.key === ' ' && !['INPUT','TEXTAREA','PASSWORD'].includes(document.activeElement.tagName) && APP.currentScreen === 'patient-screen') { e.preventDefault(); toggleVoice(); }
});

/* ── Dashboard auto-refresh ───────────────────────────────── */
setInterval(() => { if (APP.currentScreen === 'dashboard-screen') refreshDashboard(); }, 2000);

/* ── Init ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initBroadcast();
  updateClock();
  if (APP.synthesis) APP.synthesis.onvoiceschanged = () => APP.synthesis.getVoices();
  APP.allPatients = JSON.parse(localStorage.getItem('care-patients') || '[]');
  console.log('C.A.R.E. — Ready');
});
