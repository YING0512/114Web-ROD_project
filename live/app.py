from flask import Flask, render_template, request, jsonify
from ultralytics import YOLO
import cv2, numpy as np, base64

app = Flask(__name__)

# 載入你自己訓練完成後的 best.pt
model = YOLO(r"C:\ROD\SeniorRod\yolov11_v4\weights\best.pt")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/detect", methods=["POST"])
def detect():
    # 1. 前端傳來 data URL
    data = request.json["image"]
    header, encoded = data.split(",", 1)
    img_data = base64.b64decode(encoded)
    nparr = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # 2. 偵測並畫框
    result = model(frame)[0]
    annotated = result.plot()

    # 3. 編碼成 JPEG 並回傳 base64
    _, buf = cv2.imencode(".jpg", annotated)
    jpg_b64 = base64.b64encode(buf).decode("utf-8")
    return jsonify({"image": "data:image/jpeg;base64," + jpg_b64})

if __name__ == "__main__":
    # 開啟 debug 模式方便開發
    app.run(host="0.0.0.0", port=5000, debug=True)
