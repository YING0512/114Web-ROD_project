# detect_yolo8_gui.py
import tkinter as tk
from tkinter import filedialog
from ultralytics import YOLO
import cv2
import os

# 1. 先跳出對話窗，讓使用者選擇檔案
def select_file():
    root = tk.Tk()
    root.withdraw()  # 不顯示主視窗
    filetypes = [
        ("影像或影片檔", "*.jpg *.jpeg *.png *.bmp *.mp4 *.avi *.mov *.mkv"),
        ("所有檔案", "*.*"),
    ]
    path = filedialog.askopenfilename(
        title="選擇影像或影片檔",
        filetypes=filetypes
    )
    return path

# 2. 圖片偵測
def process_image(model, img_path):
    results = model(img_path, conf=0.25)
    for r in results:
        frame = r.plot()
        cv2.imshow("YOLOv8 圖片偵測", frame)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

# 3. 影片偵測
def process_video(model, vid_path):
    cap = cv2.VideoCapture(vid_path)
    if not cap.isOpened():
        print(f"無法開啟影片：{vid_path}")
        return
    while True:
        ret, frame = cap.read()
        if not ret: break
        for r in model(frame, stream=True, conf=0.25):
            frame = r.plot()
        cv2.imshow("YOLOv8 影片偵測", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    cap.release()
    cv2.destroyAllWindows()

def main():
    path = select_file()
    if not path:
        print("使用者未選擇任何檔案，程式結束")
        return

    # 載入 COCO 預訓練模型（yolov8n.pt）
    model = YOLO("yolov8n.pt")

    ext = os.path.splitext(path)[1].lower()
    if ext in [".mp4", ".avi", ".mov", ".mkv"]:
        process_video(model, path)
    else:
        process_image(model, path)

if __name__ == "__main__":
    main()
