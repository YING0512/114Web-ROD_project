from flask import Flask, Response
import cv2
app = Flask(__name__)

def generate_frames():
    # 開啟攝影機
    cap = cv2.VideoCapture(0)
    while True:
        # 讀取攝影機畫面
        ret, frame = cap.read() # ret 影像讀取成功與否的布林值，frame 是讀取到的影像。
        if not ret:
            break
        else:
            # 將畫面編碼為 JPEG 格式
            ret, buffer = cv2.imencode('.jpg', frame) 
            # 將讀取到的影像 frame 編碼為 JPEG 格式存入 buffer。
            frame = buffer.tobytes()# 將 buffer 轉換為位元組格式，方便後續傳輸。
            # 將串流部分回傳給客戶端
            yield (b'--frame\r\n' # 每個串流部分的開始標記，以 --frame 開頭。
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n') 
                   # 串流部分的內容，包含影像資料 frame 和 MIME 類型 image/jpeg。 \r\n =\n。

@app.route('/')
def index():
    # 根路徑回傳簡單的文字
    return "hello world"

@app.route('/video_feed')
def video_feed():
    # 視訊串流路徑，回傳影像串流
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame') 
    # 使用 Response 類別將 generate_frames() 產生的串流回傳給客戶端，
    # 並指定 MIME 類型為 multipart/x-mixed-replace，表示這是一個多部分的資料流，
    # boundary=frame 分隔多個影像幀，讓瀏覽器知道每個幀的開始和結束。

if __name__ == '__main__':
    # 啟動 Flask 應用程式
    app.debug = True
    app.run()