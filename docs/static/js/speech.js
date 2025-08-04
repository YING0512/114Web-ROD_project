let speechEnabled = true;
let isSpeakingDetection = false;
window.voiceBatchSelect = function () {};

// ✅ 共用初始化辨識器
function initRecognizer(recog) {
  recog.onend = () => recog.stop();
  recog.onerror = (err) => {
    console.warn("語音辨識錯誤：", err);
    speakNav("語音辨識失敗，請再試一次");
  };
}

// ===== 初始化語音 UI 與開關控制 =====
window.initSpeechUI = function () {
  if (window._speechInited) return;
  window._speechInited = true;

  const speechToggle = document.getElementById('speechToggle');
  const speechIcon = document.getElementById('speechIcon');

  // ✅ 強制同步開關狀態
  speechEnabled = speechToggle.checked;
  speechIcon.className = speechEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  speechToggle.title = speechEnabled ? '語音：開' : '語音：關';

  speechToggle.addEventListener('change', () => {
    speechEnabled = speechToggle.checked;
    speechIcon.className = speechEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    speechToggle.title = speechEnabled ? '語音：開' : '語音：關';
    if (speechEnabled) speakNav('語音已開啟');
  });

  // 三連擊切換語音開關
  let clicks = 0, timer;
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('#speechToggle')) return;
    clicks++;
    if (clicks === 1) {
      timer = setTimeout(() => { clicks = 0; }, 800);
    } else if (clicks === 3) {
      clearTimeout(timer);
      clicks = 0;
      speechToggle.checked = !speechToggle.checked;
      speechToggle.dispatchEvent(new Event('change'));
    }
  });
};

// ====== 共用語音播報 ======
window.speakNav = function (text) {
  if (!speechEnabled) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  speechSynthesis.speak(u);
};

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
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    speakNav('您的瀏覽器不支援語音輸入');
    return;
  }

  // ========== index 頁面 ==========
  if (mode === 'index') {
    speakNavAndThen('請選擇功能：導航、取消導航、朗讀模式、定位、辨識', function () {
      let recog1 = new SpeechRecognition();
      initRecognizer(recog1);
      recog1.lang = 'zh-TW';
      recog1.interimResults = false;
      recog1.maxAlternatives = 1;
      recog1.start();

      recog1.onresult = function (e) {
        const t = e.results[0][0].transcript.trim();

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

              window.isVoiceSelection = true;
              window.searchResultsData = [];
              window.currentBatchStart = 0;
              document.getElementById('searchResults').innerHTML = '';
              document.getElementById('searchInput').value = transcript;
              document.getElementById('searchInput').dispatchEvent(new Event('input'));
              
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

        if (/定位/.test(t)) {
          const locateBtn = document.getElementById('locateBtn');
          if (locateBtn) {
            speakNav('正在定位');
            locateBtn.click();
            setTimeout(() => speakNav('定位完成'), 2000);
          }
          return;
        }

        if (/辨識/.test(t)) {
          const cameraBtn = document.getElementById('cameraBtn');
          if (cameraBtn) {
            speakNav('正在跳轉到辨識');
            cameraBtn.click();
          }
          return;
        }

        speakNav('未識別的語音指令');
      };
    });

    // ===== 地點選擇語音流程 =====
    window.voiceBatchSelect = function () {
      if (!window.searchResultsData || window.searchResultsData.length === 0) return;
      let batch = window.searchResultsData.slice(window.currentBatchStart, window.currentBatchStart + 5);
      let i = 0;

      function speakBatchOptions() {
        if (i < batch.length) {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(`第${i + 1}筆，${batch[i].display_name}`);
          u.lang = 'zh-TW';
          u.onend = () => { i++; speakBatchOptions(); };
          speechSynthesis.speak(u);
        } else {
          speechSynthesis.cancel();
          const tip = new SpeechSynthesisUtterance('請說第幾筆選擇，或說下一組');
          tip.lang = 'zh-TW';
          tip.onend = () => {
            setTimeout(startVoiceSelect, 200);
          };
          speechSynthesis.speak(tip);
        }
      }

      function startVoiceSelect() {
        let recog = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        initRecognizer(recog);
        recog.lang = 'zh-TW';
        recog.interimResults = false;
        recog.maxAlternatives = 1;
        recog.start();

        recog.onresult = function (ev) {
          const transcript = ev.results[0][0].transcript.trim();
          const numMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
          let sel = null;
          for (let k in numMap) {
            if (transcript.includes(k)) { sel = numMap[k]; break; }
          }
          if (sel != null) {
            const idx = window.currentBatchStart + sel - 1;
            if (idx < window.searchResultsData.length) {
              speakNav('正在導航到目的地');
              handleDestinationSelect(window.searchResultsData[idx]);
              return;
            }
          }
          if (/下|下一|再來/.test(transcript)) {
            window.currentBatchStart += 5;
            displayBatch();
            return;
          }
          speakNav('請再說一次，第幾筆或下一組');
          setTimeout(window.voiceBatchSelect, 800);
        };
      }

      speakBatchOptions();
    };
  }

  // ========== detect 頁面 ==========
  if (mode === 'detect') {
    speakNavAndThen('請選擇功能：朗讀模式、地圖', function () {
      let recog1 = new SpeechRecognition();
      initRecognizer(recog1);
      recog1.lang = 'zh-TW';
      recog1.interimResults = false;
      recog1.maxAlternatives = 1;
      recog1.start();

      recog1.onresult = function (e) {
        const t = e.results[0][0].transcript.trim();

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

        if (/地圖/.test(t)) {
          const mapBtn = document.getElementById('mapBtn');
          speakNav('正在跳轉到地圖');
          if (mapBtn) mapBtn.click();
          return;
        }

        speakNav('未識別的語音指令');
      };
    });
  }
};



// // =========== 共用語音播報 ===========
// window.speakNav = function (text) {
//   if (!speechEnabled) return;
//   const u = new SpeechSynthesisUtterance(text);
//   u.lang = 'zh-TW';
//   speechSynthesis.speak(u);
// }
