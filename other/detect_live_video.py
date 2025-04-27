# realtime_yolo8_detection.py
import os
import cv2
import argparse
from ultralytics import YOLO

# ———— 參數設定 ————
# 輸入來源：攝影機索引或影片檔
parser = argparse.ArgumentParser(description="YOLOv8 即時檢測範例")
parser.add_argument(
    "--source", type=str, default="0",
    help=r"C:\ROD\20250312_152638.mp4"
)
parser.add_argument(
    "--model", type=str, default="yolov8n.pt",
    help="yolov8n.pt"
)
args = parser.parse_args()

# 判別來源是數字還是檔案
src = int(args.source) if args.source.isdigit() else args.source
if not (isinstance(src, int) or os.path.isfile(src)):
    raise ValueError(f"找不到來源：{args.source}")

# ———— 載入 YOLOv8 模型 ————
model = YOLO(args.model)

# ———— 開啟來源 ————
cap = cv2.VideoCapture(src)
if not cap.isOpened():
    raise RuntimeError(f"無法打開來源：{args.source}")
fps = cap.get(cv2.CAP_PROP_FPS) if not isinstance(src, int) else None
print(f"Source: {args.source}，FPS: {fps if fps else '（即時鏡頭）'}")

# ———— 逐幀偵測並畫框 ————
while True:
    ret, frame = cap.read()
    if not ret:
        break

    # 使用 YOLOv8 偵測（batch_size=1）
    results = model.predict(source=frame, stream=True, imgsz=640, conf=0.5, iou=0.45)
    # results 是一個 generator，每個 item 代表一張圖的偵測結果
    for r in results:
        # r.boxes.xyxy: [N,4]；r.boxes.conf: [N]；r.boxes.cls: [N]
        boxes = r.boxes.xyxy.cpu().numpy()
        confs = r.boxes.conf.cpu().numpy()
        cls_ids = r.boxes.cls.cpu().numpy().astype(int)

        for (x1, y1, x2, y2), conf, cid in zip(boxes, confs, cls_ids):
            # 轉為整數座標
            x1, y1, x2, y2 = map(int, (x1, y1, x2, y2))
            label = model.names[cid]  # 類別名稱
            text  = f"{label} {conf*100:.1f}%"
            # 畫框和文字
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0,255,0), 2)
            cv2.putText(frame, text, (x1, y1-5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2)

            # ————（可選）CNN 分類流程 ————
            # roi = frame[y1:y2, x1:x2]
            # 把 roi 丟給你的 cnn_model 做更細分類，再畫文字蓋掉上面 label

    cv2.imshow("YOLOv8 Detection", frame)
    delay = int(1000/fps) if fps else 1
    if cv2.waitKey(delay) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
