from flask import Flask, Response
import cv2
import torch

app = Flask(__name__)

# 載入 YOLO 模型
model = torch.hub.load('ultralytics/yolov5', 'yolov5s')  # YOLOv5 模型
vehicle_classes = ['car', 'truck', 'bus', 'motorcycle']  # 車輛類別

def detect_vehicles(frame):
    """
    利用 YOLO 模型辨識畫面中的車輛，並在畫面上標註。
    """
    results = model(frame)  # 進行物件辨識
    for result in results.xyxy[0]:
        x1, y1, x2, y2, conf, cls = result  # 取得每個物件的邊界框資訊
        if model.names[int(cls)] in vehicle_classes:  # 檢查是否為車輛類別
            label = f'{model.names[int(cls)]} {conf:.2f}'  # 顯示標籤
            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)  # 畫框
            cv2.putText(frame, label, (int(x1), int(y1) - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)  # 顯示文字標籤
    return frame

def generate_frames():
    """
    從攝影機擷取畫面，並進行即時車輛檢測。
    """
    cap = cv2.VideoCapture(0)  # 開啟攝影機
    while True:
        ret, frame = cap.read()  # 讀取攝影機畫面
        if not ret:
            break
        else:
            # 執行車輛檢測並標註
            frame = detect_vehicles(frame)

            # 將畫面編碼為 JPEG 格式
            ret, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            
            # 回傳影像串流給客戶端
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return "Vehicle Detection Stream"

@app.route('/video_feed')
def video_feed():
    """
    視訊串流路徑，回傳辨識後的影像串流。
    """
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.debug = True
    app.run()
