// 全域變數：語音開關狀態
let speechEnabled = true;
// 偵測畫面時是否正在播報
let isSpeakingDetection = false;
// 在 detect/index 共用的空函式，實際行為由對應頁面覆寫
window.voiceBatchSelect = function () {};

// ✅ 共用初始化 SpeechRecognition 錯誤與結束行為
function initRecognizer(recog) {
  // 偵測結束時強制停止辨識器
  recog.onend = () => recog.stop();
  // 辨識錯誤時提示並播報
  recog.onerror = (err) => {
    console.warn("語音辨識錯誤：", err);
    speakNav("語音辨識失敗，請再試一次");
  };
}

// ===== 初始化語音 UI 與開關控制 =====
window.initSpeechUI = function () {
  // 防止重複初始化
  if (window._speechInited) return;
  window._speechInited = true;

  const speechToggle = document.getElementById('speechToggle');
  const speechIcon   = document.getElementById('speechIcon');

  // 同步切換開關狀態與圖示
  speechEnabled = speechToggle.checked;
  speechIcon.className  = speechEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  speechToggle.title    = speechEnabled ? '語音：開' : '語音：關';

  // 監聽開關變化，更新狀態並播報
  speechToggle.addEventListener('change', () => {
    speechEnabled = speechToggle.checked;
    speechIcon.className = speechEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    speechToggle.title   = speechEnabled ? '語音：開' : '語音：關';
    if (speechEnabled) speakNav('語音已開啟');
  });

  // 三連擊任意空白區域也可切換語音開關
  let clicks = 0, timer;
  document.body.addEventListener('click', (e) => {
    // 點擊切換按鈕本身不算
    if (e.target.closest('#speechToggle')) return;
    clicks++;
    if (clicks === 1) {
      timer = setTimeout(() => { clicks = 0; }, 800);
    } else if (clicks === 3) {
      clearTimeout(timer);
      clicks = 0;
      // 反向切換並觸發 change 事件
      speechToggle.checked = !speechToggle.checked;
      speechToggle.dispatchEvent(new Event('change'));
    }
  });
};

// ====== 共用語音播報 ======
window.speakNav = function (text) {
  // 若語音關閉則跳過
  if (!speechEnabled) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  speechSynthesis.speak(u);
};

// 播報完畢後再執行 callback（帶 250ms 延遲）
window.speakNavAndThen = function (text, callback) {
  if (!speechEnabled) {
    if (typeof callback === 'function') callback();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  u.onend = function () {
    setTimeout(callback, 250);
  };
  speechSynthesis.speak(u);
};

// ====== 語音輸入主流程 ======
window.startVoiceCommand = function ({ mode }) {
  // 取得瀏覽器支援的 SpeechRecognition
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    speakNav('您的瀏覽器不支援語音輸入');
    return;
  }

  // ========== index 頁面模式 ==========
  if (mode === 'index') {
    // 首先播報可用指令選單，結束後啟動辨識
    speakNavAndThen('請選擇功能：導航、取消導航、朗讀模式、定位、辨識', function () {
      let recog1 = new SpeechRecognition();
      initRecognizer(recog1);
      recog1.lang = 'zh-TW';
      recog1.interimResults = false;
      recog1.maxAlternatives = 1;
      recog1.start();

      // 處理第一次指令結果
      recog1.onresult = function (e) {
        const t = e.results[0][0].transcript.trim();

        // ===== 取消導航 =====
        if (/取消導航|停止導航|取消/.test(t)) {
          const cancelBtn = document.querySelector('.cancelRouteBtn');
          if (cancelBtn) {
            cancelBtn.click();
            speakNav('已取消導航');
            window.isNavigating = false;
          } else {
            speakNav('目前沒有正在導航');
          }
          return;
        }

        // ===== 開始導航 =====
        if (/導航/.test(t)) {
          speakNavAndThen('請說出地點名稱', function () {
            let recog2 = new SpeechRecognition();
            initRecognizer(recog2);
            recog2.lang = 'zh-TW';
            recog2.interimResults = false;
            recog2.maxAlternatives = 1;
            recog2.start();

            recog2.onresult = function (ev) {
              const transcript = ev.results[0][0].transcript.trim();

              // 允許在輸入地點時再取消導航
              if (/取消導航|停止導航/.test(transcript)) {
                const cancelBtn = document.querySelector('.cancelRouteBtn');
                if (cancelBtn) {
                  cancelBtn.click();
                  speakNav('已取消導航');
                  window.isNavigating = false;
                } else {
                  speakNav('目前沒有正在導航');
                }
                window.isVoiceSelection = false;
                return;
              }

              // 進入語音選擇流程，先清空舊結果
              window.isVoiceSelection    = true;
              window.searchResultsData   = [];
              window.currentBatchStart   = 0;
              document.getElementById('searchResults').innerHTML = '';
              document.getElementById('searchInput').value = transcript;
              document.getElementById('searchInput').dispatchEvent(new Event('input'));
              
              // 手動呼叫搜尋 API 並觸發批次選擇
              fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(transcript)}`)
                .then(r => r.json())
                .then(data => {
                  if (!data.length) {
                    speakNav('找不到地點');
                    window.isVoiceSelection = false;
                    return;
                  }
                  window.searchResultsData = data;
                  window.currentBatchStart = 0;
                  displayBatch();
                  window.voiceBatchSelect();
                }).catch(() => {
                  speakNav('搜尋錯誤');
                });
            };
          });
          return;
        }

        // ===== 朗讀模式開關 =====
        if (/朗讀/.test(t)) {
          speakNavAndThen('需要開啟或關閉？', function () {
            let recog2 = new SpeechRecognition();
            initRecognizer(recog2);
            recog2.lang = 'zh-TW';
            recog2.interimResults = false;
            recog2.maxAlternatives = 1;
            recog2.start();

            recog2.onresult = function (e2) {
              const t2 = e2.results[0][0].transcript.trim();
              const speechToggle = document.getElementById('speechToggle');
              if (/開|啟/.test(t2)) {
                if (!speechToggle.checked) {
                  speechToggle.checked = true;
                  speechToggle.dispatchEvent(new Event('change'));
                }
                speakNav('朗讀模式已開啟');
              } else if (/關/.test(t2)) {
                if (speechToggle.checked) {
                  speechToggle.checked = false;
                  speechToggle.dispatchEvent(new Event('change'));
                }
                speakNav('朗讀模式已關閉');
              } else {
                speakNav('請再說一次，需要開啟或關閉');
              }
            };
          });
          return;
        }

        // ===== 定位 =====
        if (/定位/.test(t)) {
          const locateBtn = document.getElementById('locateBtn');
          if (locateBtn) {
            speakNav('正在定位');
            locateBtn.click();
            setTimeout(() => speakNav('定位完成'), 2000);
          }
          return;
        }

        // ===== 跳轉辨識頁面 =====
        if (/辨識/.test(t)) {
          const cameraBtn = document.getElementById('cameraBtn');
          if (cameraBtn) {
            speakNav('正在跳轉到辨識');
            cameraBtn.click();
          }
          return;
        }

        // 若未匹配任何指令，告知無識別
        speakNav('未識別的語音指令');
      };
    });

    // ===== 地點選擇語音流程 =====
    window.voiceBatchSelect = function () {
      // 若無搜尋結果則不進入流程
      if (!window.searchResultsData || window.searchResultsData.length === 0) return;
      // 取出當前批次（最多 5 筆）
      let batch = window.searchResultsData.slice(window.currentBatchStart, window.currentBatchStart + 5);
      let i = 0;

      // 依序朗讀每筆選項
      function speakBatchOptions() {
        if (i < batch.length) {
          speechSynthesis.cancel();  // 取消正在播報的語音
          const u = new SpeechSynthesisUtterance(`第${i + 1}筆，${batch[i].display_name}`);
          u.lang = 'zh-TW';
          u.onend = () => { i++; speakBatchOptions(); };  // 唸完後遞迴至下一筆
          speechSynthesis.speak(u);
        } else {
          // 朗讀完畢後提示用戶選擇或換下一組
          speechSynthesis.cancel();
          const tip = new SpeechSynthesisUtterance('請說第幾筆選擇，或說下一組');
          tip.lang = 'zh-TW';
          tip.onend = () => {
            setTimeout(startVoiceSelect, 200);  // 延遲觸發語音辨識
          };
          speechSynthesis.speak(tip);
        }
      }

      // 啟動語音辨識以接收用戶回應
      function startVoiceSelect() {
        let recog = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        initRecognizer(recog);  // 共用初始化錯誤與結束行為
        recog.lang = 'zh-TW';
        recog.interimResults = false;
        recog.maxAlternatives = 1;
        recog.start();

        recog.onresult = function (ev) {
          const transcript = ev.results[0][0].transcript.trim();
          // 中文及阿拉伯數字對應至編號
          const numMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
          let sel = null;
          for (let k in numMap) {
            if (transcript.includes(k)) { sel = numMap[k]; break; }
          }
          // 若成功辨識編號且在範圍內，啟動導航
          if (sel != null) {
            const idx = window.currentBatchStart + sel - 1;
            if (idx < window.searchResultsData.length) {
              speakNav('正在導航到目的地');
              handleDestinationSelect(window.searchResultsData[idx]);
              return;
            }
          }
          // 若講到「下一組」等關鍵字，切到下一批
          if (/下|下一|再來/.test(transcript)) {
            window.currentBatchStart += 5;
            displayBatch();  // 更新畫面列表
            return;
          }
          // 其他情況重試
          speakNav('請再說一次，第幾筆或下一組');
          setTimeout(window.voiceBatchSelect, 800);
        };
      }

      // 啟動朗讀流程
      speakBatchOptions();
    };
  }

  // ========== detect 頁面語音流程 ==========
  if (mode === 'detect') {
    // 提示並引導用戶選擇朗讀或回地圖
    speakNavAndThen('請選擇功能：朗讀模式、地圖', function () {
      let recog1 = new SpeechRecognition();
      initRecognizer(recog1);
      recog1.lang = 'zh-TW';
      recog1.interimResults = false;
      recog1.maxAlternatives = 1;
      recog1.start();

      recog1.onresult = function (e) {
        const t = e.results[0][0].transcript.trim();

        // ===== 切換朗讀模式 =====
        if (/朗讀/.test(t)) {
          speakNavAndThen('需要開啟或關閉？', function () {
            let recog2 = new SpeechRecognition();
            initRecognizer(recog2);
            recog2.lang = 'zh-TW';
            recog2.interimResults = false;
            recog2.maxAlternatives = 1;
            recog2.start();

            recog2.onresult = function (e2) {
              const t2 = e2.results[0][0].transcript.trim();
              const speechToggle = document.getElementById('speechToggle');
              // 根據用戶回應開啟或關閉朗讀
              if (/開|啟/.test(t2)) {
                if (!speechToggle.checked) {
                  speechToggle.checked = true;
                  speechToggle.dispatchEvent(new Event('change'));
                }
                speakNav('朗讀模式已開啟');
              } else if (/關/.test(t2)) {
                if (speechToggle.checked) {
                  speechToggle.checked = false;
                  speechToggle.dispatchEvent(new Event('change'));
                }
                speakNav('朗讀模式已關閉');
              } else {
                // 無法識別再提示
                speakNav('請再說一次，需要開啟或關閉');
              }
            };
          });
          return;
        }

        // ===== 返回地圖 =====
        if (/地圖/.test(t)) {
          const mapBtn = document.getElementById('mapBtn');
          speakNav('正在跳轉到地圖');
          if (mapBtn) mapBtn.click();
          return;
        }

        // 無效指令提示
        speakNav('未識別的語音指令');
      };
    });
  }

};
