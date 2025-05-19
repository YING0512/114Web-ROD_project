from flask import Flask, render_template, request, jsonify  # 引入 Flask 核心功能與模板、請求、JSON 回傳
import os                                            # 檔案路徑操作
import base64                                        # Base64 解碼
import cv2                                           # OpenCV 影像處理
import numpy as np                                   # 數值運算
from ultralytics import YOLO                         # Ultralytics YOLO 模型

# 建立 Flask 應用，指定模板與靜態資料夾路徑
app = Flask(__name__, template_folder="templates", static_folder="static")

# 定義 YOLO 模型路徑，指向權重檔 best.pt
MODEL_PATH = os.path.join(
    os.path.dirname(__file__),  # 目前 app.py 所在資料夾
    "..",                     # 上層資料夾
    "SeniorRod",              # 專案資料夾名稱
    "yolov11_v4",             # 模型資料夾
    "weights",                # 權重資料夾
    "best.pt"                 # 權重檔案
)
# 載入模型，準備推論
model = YOLO(MODEL_PATH)

@app.route("/", methods=["GET"])
def index():
    """
    首頁路由：處理 GET 請求，回傳 index.html 模板
    """
    return render_template("index.html")

@app.route("/detect", methods=["GET", "POST"])
def detect():
    """
    偵測頁面路由：
    - GET 請求：回傳 detect.html 模板
    - POST 請求：接收前端影像、執行物件偵測、回傳結果
    """
    if request.method == "GET":
        return render_template("detect.html")

    # ---------- 處理 POST 請求：影像解析與偵測 ----------
    data = request.json.get("image", "")            # 從 JSON 取得 base64 圖片資料
    header, encoded = data.split(",", 1)              # 分割標頭與編碼內容
    # Base64 解碼並轉為 NumPy 陣列，再以 OpenCV 解碼成影像
    img = cv2.imdecode(
        np.frombuffer(base64.b64decode(encoded), dtype=np.uint8),
        cv2.IMREAD_COLOR
    )

    # 使用 YOLO 模型進行推論，取得第一筆結果物件資訊
    result = model(img)[0]
    # 取得邊界框座標列表，用於前端繪製遮罩
    xyxy = result.boxes.xyxy.cpu().numpy().tolist()

    # 取得影像尺寸，用以定義安全區域
    h, w = img.shape[:2]
    safe_x1, safe_x2 = 0.2 * w, 0.8 * w  # 水平安全範圍
    safe_y1, safe_y2 = 0.5 * h, h        # 垂直安全範圍

    region = None  # 初始化檢測區域

    # ---------- 優先檢查 stairs 類別 ----------
    for box, cls in zip(result.boxes.xyxy, result.boxes.cls):
        if result.names[int(cls)] == "stairs":
            # 算出框中心 x 座標
            cx = (box[0] + box[2]) / 2
            # 根據中心位置判斷左、中、右
            region = "左方" if cx < w / 3 else "右方" if cx > 2 * w / 3 else "前方"
            text = f"{region}台階 小心行走"
            break

    # ---------- 若未偵測到 stairs，檢查 obstacle ----------
    if region is None:
        viol = None
        for box in result.boxes.xyxy:
            cx = (box[0]+box[2])/2; cy = (box[1]+box[3])/2
            if not (safe_x1<=cx<=safe_x2 and safe_y1<=cy<=safe_y2):
                region = "左方" if cx<w/3 else "右方" if cx>2*w/3 else "前方"
                if region=="左方":
                    text = "左方障礙物  靠右行走"
                elif region == "右方":
                    text = "右方障礙物  靠左行走"
                else:
                    text = "前方障礙物  靠外側行走"
                break

    # ---------- 若仍無任何危險，顯示安全訊息 ----------
    if region is None:
        text = "前方安全 可繼續直行"

    # 回傳 JSON，包含遮罩座標與文字提示
    return jsonify({
        "boxes": xyxy,
        "result": text
    })

if __name__ == "__main__":
    # 啟動 Flask 開發伺服器：監聽所有介面，5000 埠，開啟偵錯模式
    app.run(host="0.0.0.0", port=5000, debug=True)