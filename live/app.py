from flask import Flask, render_template, request, jsonify
from ultralytics import YOLO
import cv2, numpy as np, base64

app = Flask(__name__)
model = YOLO("yolov8n.pt")  # COCO 預訓練模型&#8203;:contentReference[oaicite:2]{index=2}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/detect", methods=["POST"])
def detect():
    data = request.json["image"]
    header, encoded = data.split(",", 1)
    img_data = base64.b64decode(encoded)
    nparr = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    # 偵測並畫框
    result = model(frame)[0]
    annotated = result.plot()
    _, buf = cv2.imencode(".jpg", annotated)
    jpg_b64 = base64.b64encode(buf).decode("utf-8")
    return jsonify({"image": "data:image/jpeg;base64," + jpg_b64})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
