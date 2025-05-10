from flask import Flask, render_template, request, jsonify
import os, base64, cv2, numpy as np
from ultralytics import YOLO

app = Flask(__name__, template_folder="templates", static_folder="static")

# 模型路徑
MODEL_PATH = os.path.join(os.path.dirname(__file__),
                          "..","SeniorRod","yolov11_v4","weights","best.pt")
model = YOLO(MODEL_PATH)

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route("/detect", methods=["GET","POST"])
def detect():
    if request.method=="GET":
        return render_template("detect.html")

    # 解析影像
    data = request.json.get("image","")
    header, encoded = data.split(",",1)
    img = cv2.imdecode(
        np.frombuffer(base64.b64decode(encoded), np.uint8),
        cv2.IMREAD_COLOR
    )

    # 推論
    result = model(img)[0]
    xyxy = result.boxes.xyxy.cpu().numpy().tolist()

    h, w = img.shape[:2]
    safe_x1, safe_x2 = 0.2*w, 0.8*w
    safe_y1, safe_y2 = 0.5*h, h

    # 判斷 stairs 還是 obstacle
    region = None
    # 優先 stair
    for box,cls in zip(result.boxes.xyxy, result.boxes.cls):
        if result.names[int(cls)]=="stairs":
            cx = (box[0]+box[2])/2
            region = "左方" if cx<w/3 else "右方" if cx>2*w/3 else "前方"
            text = f"{region}台階 小心行走"
            break

    # 若沒 stair，再檢查 obstacle
    if region is None:
        viol = None
        for box in result.boxes.xyxy:
            cx = (box[0]+box[2])/2; cy = (box[1]+box[3])/2
            if not (safe_x1<=cx<=safe_x2 and safe_y1<=cy<=safe_y2):
                region = "左方" if cx<w/3 else "右方" if cx>2*w/3 else "前方"
                if region=="左方":
                    text = "左方障礙物  靠右行走"
                elif region=="右方":
                    text = "右方障礙物  靠左行走"
                else:
                    text = "前方障礙物  靠外側行走"
                break

    # 全安全
    if region is None:
        text = "前方安全 可繼續直行"

    return jsonify({
        "boxes": xyxy,
        "result": text
    })

if __name__=="__main__":
    app.run(host="0.0.0.0",port=5000,debug=True)