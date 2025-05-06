from flask import Flask, render_template, request, jsonify
from ultralytics import YOLO
import cv2, numpy as np, base64

app = Flask(__name__)

# 載入你自己訓練完成後的 best.pt
model = YOLO(r"C:\ROD\SeniorRod\yolov11_v4\weights\best.pt")

@app.route("/")
def index():
    return render_template("index.html")

# app.py  ── 仅示意 detect() 函式改動部分 :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
@app.route("/detect", methods=["POST"])
def detect():
    # 1. 解碼、做人臉偵測、畫框（和原本一樣）
    data = request.json["image"]
    header, encoded = data.split(",", 1)
    img_data = base64.b64decode(encoded)
    nparr = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    result = model(frame)[0]
    annotated = result.plot()
    _, buf = cv2.imencode(".jpg", annotated)
    jpg_b64 = base64.b64encode(buf).decode("utf-8")

    # 2. 方位與行進範圍後處理
    h , w = frame.shape[:2]

    # 定義安全區：下半部中央 60% 寬度
    safe_x_min, safe_x_max = 0.2 * w, 0.8 * w
    safe_y_min, safe_y_max = 0.5 * h, 1.0 * h

    # 1. 先檢查 stairs
    if any(result.names[int(c)] == "stairs" for c in result.boxes.cls):
        movement = "台階"
    else:
        violation = None
        # 2. 找第一個中心點不在安全區內的物件
        for box in result.boxes.xyxy:
            cx = (box[0] + box[2]) / 2
            cy = (box[1] + box[3]) / 2
            if not (safe_x_min <= cx <= safe_x_max and safe_y_min <= cy <= safe_y_max):
                if cx < safe_x_min:
                    violation = ("左方", "請往右邊走")
                elif cx > safe_x_max:
                    violation = ("右方", "請往左邊走")
                else:
                    violation = ("前方", "請往外側走")
                break
        if violation:
            movement = f"離開安全範圍 {violation[1]}"
        else:
            movement = "安全"

    # 3. 方位分類（同之前的左右前方物件列表）
    objs = {"左方": [], "前方": [], "右方": []}
    for box, cls in zip(result.boxes.xyxy, result.boxes.cls):
        cx = (box[0] + box[2]) / 2
        ori = "左方" if cx < w/3 else "右方" if cx > 2*w/3 else "前方"
        objs[ori].append(result.names[int(cls)])

    # 4. 拼文字
    lines = [f"行進範圍 {movement}"]
    for ori in ("前方","右方","左方"):
        if objs[ori]:
            lines.append(f"{ori} {'、'.join(objs[ori])}")

    # 5. 回傳 JSON
    _, buf = cv2.imencode(".jpg", result.plot())
    jpg_b64 = base64.b64encode(buf).decode()
    return jsonify({
        "image": "data:image/jpeg;base64," + jpg_b64,
        "result": "\n".join(lines)
    })


if __name__ == "__main__":
    # 開啟 debug 模式方便開發
    app.run(host="0.0.0.0", port=5000, debug=True)
