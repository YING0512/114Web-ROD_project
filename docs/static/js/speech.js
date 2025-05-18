// static/js/speech.js
// —— 語音播報模組 ——

// 表示使用者是否開啟語音
let speechEnabled = true;
// 表示偵測語音是否正在播報（用以壓制導航語音）
let isSpeakingDetection = false;

// 初始化語音：檢查支援、註冊三連點切換
export function initSpeech() {
  if (!window.speechSynthesis) {
    console.warn('此瀏覽器不支援語音播報');
  }
  let clickCount = 0, timer;
  document.addEventListener('click', () => {
    clickCount++;
    if (clickCount === 3) {
      toggleSpeech();
      clearTimeout(timer);
      clickCount = 0;
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => { clickCount = 0; }, 500);
    }
  });
}

// 切換語音開關
export function toggleSpeech() {
  speechEnabled = !speechEnabled;
  const icon = document.getElementById('speechIcon');
  const btn  = document.getElementById('speechToggle');
  if (speechEnabled) {
    icon.className = 'fa-solid fa-volume-high';
    btn.classList.add('on');
    btn.classList.remove('off');
    btn.title = '語音：開';
    // 開啟時可小播一段提示
    speakNav('語音已開啟');
  } else {
    icon.className = 'fa-solid fa-volume-xmark';
    btn.classList.add('off');
    btn.classList.remove('on');
    btn.title = '語音：關';
  }
}

// 偵測結果播報（設為優先）
export function speakDetection(text) {
  if (!speechEnabled) return;
  isSpeakingDetection = true;
  const utt = new SpeechSynthesisUtterance(text);
  utt.onend = () => { isSpeakingDetection = false; };
  speechSynthesis.speak(utt);
}

// 導航指示播報（偵測中不播）
export function speakNav(text) {
  if (!speechEnabled || isSpeakingDetection) return;
  const utt = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utt);
}
