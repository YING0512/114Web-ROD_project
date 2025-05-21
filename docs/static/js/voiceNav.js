// ===== voiceNav.js =====
document.addEventListener('DOMContentLoaded', () => {
  // 檢查是否存在語音導航按鈕，避免在其他頁面出錯
  const voiceNavBtn       = document.getElementById('voiceNavBtn');
  if (!voiceNavBtn) return;

  // 語音辨識設定
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang            = 'zh-TW';
  recognition.interimResults  = false;
  recognition.maxAlternatives = 1;

  const searchInput       = document.getElementById('searchInput');
  const resultsContainer  = document.getElementById('searchResults');

  // 點擊麥克風按鈕，清空舊結果並提示語音輸入
  voiceNavBtn.addEventListener('click', () => {
    isVoiceSelection      = true;
    searchResultsData     = [];
    currentBatchStart     = 0;
    resultsContainer.innerHTML = '';
    if (speechEnabled) speechSynthesis.cancel();
    speakNav('請說要搜尋的地點');
    recognition.start();
  });

  // 辨識開始時停止任何朗讀
  recognition.addEventListener('start', () => {
    if (speechEnabled) speechSynthesis.cancel();
  });

  // 處理辨識結果
  recognition.addEventListener('result', event => {
    if (speechEnabled) speechSynthesis.cancel();
    const transcript = event.results[0][0].transcript.trim();

    // 1. 取消導航
    if (/取消\s*(導航|导航)/i.test(transcript)) {
      const cancelBtn = document.querySelector('.cancelRouteBtn');
      if (cancelBtn) {
        cancelBtn.click();
        speakNav('已取消導航');
      }
      return;
    }

    // 2. 切換到偵測/辨識頁面
    if (/(?:辨識|偵測)/i.test(transcript)) {
      const cameraBtn = document.getElementById('cameraBtn');
      if (cameraBtn) {
        cameraBtn.click();
        speakNav('切換至辨識頁面');
      }
      return;
    }
    
    // 若已有搜尋結果，視為選擇或換批
    if (searchResultsData.length) {
      const numMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'1':1,'2':2,'3':3,'4':4,'5':5};
      let sel = null;
      for (let k in numMap) {
        if (transcript.includes(k)) { sel = numMap[k]; break; }
      }
      if (sel != null) {
        const idx = currentBatchStart + sel - 1;
        if (idx < searchResultsData.length) {
          speakNav('正在導航到目的地');
          return handleDestinationSelect(searchResultsData[idx]);
        }
      }
      if (/下|下一|再來/.test(transcript)) {
        currentBatchStart += 5;
        return displayBatch();
      }
    } else {
      // 初次語音搜尋：朗讀並觸發文字搜尋
      speakNav(`正在搜尋${transcript}，再次點擊語音並說出編號可設定導航`);
      searchInput.value = transcript;
      searchResultsData = [];
      currentBatchStart = 0;
      searchInput.dispatchEvent(new Event('input'));
      return;
    }

    // 無匹配：回填文字搜尋
    searchInput.value = transcript;
    searchResultsData = [];
    currentBatchStart = 0;
    searchInput.dispatchEvent(new Event('input'));
  });

  // 錯誤處理
  recognition.addEventListener('error', event => {
    console.error('語音辨識錯誤:', event.error);
  });
});