import os
import cv2
import numpy as np
import pickle
import tensorflow as tf
load_model      = tf.keras.models.load_model

# --- 參數設定 ---
IMAGE_SIZE = (128, 128)
CLAHE_CLIP = 2.0
MODEL_PATH = "cnn_model.h5"
ENCODER_PATH = "label_encoder.pkl"

# --- 載入模型與 LabelEncoder ---
model = load_model(MODEL_PATH)
with open(ENCODER_PATH, "rb") as f:
    le = pickle.load(f)

# --- 影像前處理函式 ---
def preprocess_frame(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, IMAGE_SIZE)
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP)
    gray = clahe.apply(gray)
    gray = gray.astype('float32') / 255.0
    return np.expand_dims(np.expand_dims(gray, axis=-1), axis=0)

# --- 開啟攝影機並即時辨識 ---
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise RuntimeError("無法開啟攝影機")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    inp = preprocess_frame(frame)
    preds = model.predict(inp)
    idx = np.argmax(preds)
    label = le.inverse_transform([idx])[0]
    prob  = preds[0][idx]

    # 將結果畫在影像上
    text = f"{label}: {prob*100:.1f}%"
    cv2.putText(frame, text, (10,30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)

    cv2.imshow("Real-time Recognition", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
