from flask import Flask, render_template, request, jsonify
import os, base64, cv2, numpy as np
from ultralytics import YOLO

# 建立 Flask，template 放在 templates，static 放在 static
app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
    static_url_path="/static"
)

# 載入模型
MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "..", "SeniorRod", "yolov11_v4", "weights", "best.pt"
)
model = YOLO(MODEL_PATH)

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

# 用同一個 URL 區分 GET/POST：GET 顯示頁面，POST 回傳辨識結果
@app.route("/detect", methods=["GET", "POST"])
def detect():
    if request.method == "GET":
        return render_template("detect.html")

    # POST 處理影像
    data = request.json.get("image", "")
    header, encoded = data.split(",", 1)
    img_data = base64.b64decode(encoded)
    nparr = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # 推論與畫框
    result = model(frame)[0]
    annotated = result.plot()

    # 定義安全區域
    h, w = frame.shape[:2]
    safe_x_min, safe_x_max = 0.2*w, 0.8*w
    safe_y_min, safe_y_max = 0.5*h, 1.0*h

    # 判斷是否有 stairs
    if any(result.names[int(c)] == "stairs" for c in result.boxes.cls):
        movement = "台階"
    else:
        violation = None
        for box in result.boxes.xyxy:
            cx = (box[0]+box[2])/2
            cy = (box[1]+box[3])/2
            if not (safe_x_min <= cx <= safe_x_max and safe_y_min <= cy <= safe_y_max):
                if cx < safe_x_min:
                    violation = ("左方", "請往右邊走")
                elif cx > safe_x_max:
                    violation = ("右方", "請往左邊走")
                else:
                    violation = ("前方", "請往外側走")
                break
        movement = violation[1] if violation else "安全"

    # 分類各方向物件
    objs = {"左方": [], "前方": [], "右方": []}
    for box, cls in zip(result.boxes.xyxy, result.boxes.cls):
        cx = (box[0]+box[2])/2
        ori = "左方" if cx<w/3 else "右方" if cx>2*w/3 else "前方"
        objs[ori].append(result.names[int(cls)])

    lines = [f"行進範圍：{movement}"]
    for ori in ("前方","右方","左方"):
        if objs[ori]:
            lines.append(f"{ori}：{'、'.join(objs[ori])}")

    # 回傳 JSON
    _, buf = cv2.imencode(".jpg", annotated)
    jpg_b64 = base64.b64encode(buf).decode()
    return jsonify({
        "image": "data:image/jpeg;base64," + jpg_b64,
        "result": "\n".join(lines)
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
