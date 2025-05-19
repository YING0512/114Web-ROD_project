// static/js/speech.js
// —— 語音播報模組 ——

// 表示使用者是否開啟語音
let speechEnabled = true;
// 表示偵測語音是否正在播報（用以壓制導航語音）
let isSpeakingDetection = false;

/**
 * 初始化語音功能
 * - 檢查瀏覽器是否支援 SpeechSynthesis API
 * - 註冊三連擊事件以切換語音開關
 */
export function initSpeech() {
  if (!window.speechSynthesis) {
    console.warn('此瀏覽器不支援語音播報');
  }
  let clickCount = 0, timer;
  document.addEventListener('click', () => {
    clickCount++;
    if (clickCount === 3) {
      // 三連擊觸發語音開關切換
      toggleSpeech();
      clearTimeout(timer);
      clickCount = 0;
    } else {
      // 若在 500ms 內未完成三連擊，重置計數
      clearTimeout(timer);
      timer = setTimeout(() => { clickCount = 0; }, 500);
    }
  });
}

/**
 * 切換語音開關狀態
 * - 更新 icon、按鈕樣式與 title
 * - 開啟時播放提示
 */
export function toggleSpeech() {
  speechEnabled = !speechEnabled;
  const icon = document.getElementById('speechIcon');
  const btn  = document.getElementById('speechToggle');
  if (speechEnabled) {
    // 開啟語音：切換為喇叭開啟圖示、樣式與提示文字，並播報提示
    icon.className = 'fa-solid fa-volume-high';
    btn.classList.add('on');
    btn.classList.remove('off');
    btn.title = '語音：開';
    speakNav('語音已開啟');
  } else {
    // 關閉語音：切換為靜音圖示、樣式與提示文字
    icon.className = 'fa-solid fa-volume-xmark';
    btn.classList.add('off');
    btn.classList.remove('on');
    btn.title = '語音：關';
  }
}

/**
 * 偵測結果播報
 * - 此播報為優先級最高，不受導航播報影響
 * @param {string} text 要播報的文字
 */
export function speakDetection(text) {
  if (!speechEnabled) return; // 若關閉語音則跳過
  isSpeakingDetection = true; // 標記為正在播報偵測語音
  const utt = new SpeechSynthesisUtterance(text);
  utt.onend = () => { isSpeakingDetection = false; };
  speechSynthesis.speak(utt);
}

/**
 * 導航指示播報
 * - 若偵測語音正在播報，則暫停導航播報
 * @param {string} text 要播報的文字
 */
export function speakNav(text) {
  if (!speechEnabled || isSpeakingDetection) return; // 若關閉語音或偵測中則跳過
  const utt = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utt);
}
