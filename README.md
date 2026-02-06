# 114Web-ROD_project (基於 Web 的即時物件偵測專案)

這是一個基於 Flask 的 Web 應用程式，利用 YOLOv11 進行即時障礙物偵測，以協助導航。它能識別安全路徑和潛在危險（如台階或障礙物）並提供方向指引。

## 功能特色

- **即時偵測**：使用 YOLOv11 模型進行快速準確的物件偵測。
- **智慧導航**：自動識別「地面 (floor)」與安全區域，判斷可行走路徑。
- **語音與視覺指引**：提供明確的方向指示（左、右、前、安全），並支援語音播報（需瀏覽器支援）。
- **跨平台 Web 介面**：透過瀏覽器即可使用，無需安裝額外客戶端軟體。

## 專案結構

- **docs/**: 主要的 Web 應用程式代碼 (Flask Server)。
    - `app.py`: 應用程式入口點。
    - `templates/`: HTML 頁面模板 (`index.html`, `detect.html`)。
    - `static/`: 靜態資源 (CSS, JS, Leaflet 地圖資源)。
- **SeniorRod/**: 存放 YOLO 模型相關檔案。
    - `yolov11_v8/weights/best.pt`: 預訓練的模型權重。
- **train/**: 模型訓練相關資料 (資料集、腳本等)。

## 安裝說明

1.  **複製專案** (Clone repository) 或下載程式碼。
2.  **進入應用程式目錄**：
    ```bash
    cd docs
    ```
3.  **安裝依賴套件**：
    建議使用虛擬環境 (Virtual Environment)。
    ```bash
    pip install -r requirements.txt
    ```

    *主要依賴：Flask, ultralytics, opencv-python, numpy*

## 使用方法

1.  **啟動應用程式**：
    在專案根目錄或 `docs` 目錄下執行：
    ```bash
    python docs/app.py
    ```
    或者若已在 `docs` 目錄內：
    ```bash
    python app.py
    ```

2.  **開啟瀏覽器**：
    前往 `http://localhost:5000` (或終端機顯示的網址)。

3.  **開始偵測**：
    - 首頁點擊相關按鈕進入偵測頁面。
    - 允許瀏覽器使用相機權限。
    - 系統將即時分析畫面並給予導航建議。
