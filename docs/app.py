from flask import Flask, render_template, request, jsonify  # 引入 Flask 核心、模板與 JSON 回傳
import os      # 檔案與路徑操作
import base64  # Base64 編／解碼
import cv2     # OpenCV 影像處理
import numpy as np  # 數值運算
from ultralytics import YOLO  # 載入 YOLO 模型

# 建立 Flask 應用，設定模板與靜態檔案資料夾
app = Flask(__name__, template_folder="templates", static_folder="static")

# 模型權重路徑：指向 upper/SeniorRod/yolov11_v8/weights/best.pt
MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "SeniorRod",
    "yolov11_v8",
    "weights",
    "best.pt"
)
# 載入 YOLO 模型
model = YOLO(MODEL_PATH)

@app.route("/", methods=["GET"])
def index():
    """首頁：回傳 index.html"""
    return render_template("index.html")

@app.route("/detect", methods=["GET", "POST"])
def detect():
    """
    偵測頁面：
    GET → 回傳 detect.html
    POST → 接收前端影像、執行物件偵測、回傳結果
    """
    if request.method == "GET":
        return render_template("detect.html")

    # 解析 POST JSON 影像資料 (data:image/jpeg;base64,...)
    data = request.json.get("image", "")
    header, encoded = data.split(",", 1)
    # 解碼並轉為 OpenCV 影像
    img = cv2.imdecode(
        np.frombuffer(base64.b64decode(encoded), dtype=np.uint8),
        cv2.IMREAD_COLOR
    )

    # 模型推論，取得第一筆結果
    result = model(img)[0]

    # 建立標註框清單：x1, y1, x2, y2, label, score
    boxes_info = []
    for box, cls, conf in zip(result.boxes.xyxy, result.boxes.cls, result.boxes.conf):
        x1, y1, x2, y2 = box.cpu().numpy().tolist()
        label = result.names[int(cls)]
        score = float(conf)
        boxes_info.append({
            "x1": x1, "y1": y1,
            "x2": x2, "y2": y2,
            "label": label,
            "score": round(score, 2)
        })

    # 定義安全區域：水平 20%-80%，垂直 50%-100%
    h, w = img.shape[:2]
    safe_x1, safe_x2 = 0.2 * w, 0.8 * w
    safe_y1, safe_y2 = 0.5 * h, h

    region = None  # 初始化檢測區域

    # 優先檢查 "floor" 類別，判斷台階方位
    for box, cls in zip(result.boxes.xyxy, result.boxes.cls):
        if result.names[int(cls)] == "floor":
            cx = (box[0] + box[2]) / 2
            region = "左方" if cx < w/3 else "右方" if cx > 2*w/3 else "前方"
            text = f"{region}台階 小心行走"
            break

    # 若沒偵測到 floor，檢查其他障礙物是否超出安全區
    if region is None:
        viol = None
        for box in result.boxes.xyxy:
            cx = (box[0] + box[2]) / 2
            cy = (box[1] + box[3]) / 2
            if not (safe_x1 <= cx <= safe_x2 and safe_y1 <= cy <= safe_y2):
                region = "左方" if cx < w/3 else "右方" if cx > 2*w/3 else "前方"
                if region == "左方":
                    text = "左方障礙物  靠右行走"
                elif region == "右方":
                    text = "右方障礙物  靠左行走"
                else:
                    text = "前方障礙物  靠外側行走"
                break

    # 若仍無危險，顯示安全訊息
    if region is None:
        text = "前方安全 可繼續直行"

    # 回傳 JSON 包含標註框與提示文字
    return jsonify({
        "boxes": boxes_info,
        "result": text
    })

if __name__ == "__main__":
    # 啟動 Flask 開發伺服器 (host: 0.0.0.0, port:5000, debug on)
    app.run(host="0.0.0.0", port=5000, debug=True)
