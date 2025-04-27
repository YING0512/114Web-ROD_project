# 訓練 CNN 模型  
import os
import cv2
import numpy as np
import pickle
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import tensorflow as tf
from keras import layers, models

to_categorical = tf.keras.utils.to_categorical
ImageDataGenerator = tf.keras.preprocessing.image.ImageDataGenerator

# --- 參數設定 ---
IMAGE_SIZE = (128, 128)
BATCH_SIZE = 32
EPOCHS = 10
CLAHE_CLIP = 2.0

# --- 資料路徑 ---
TRAIN_DIR = "Senior-Design-VIAD-4/reorganized/train"
VALID_DIR = "Senior-Design-VIAD-4/reorganized/valid"
TEST_DIR  = "Senior-Design-VIAD-4/reorganized/test"


# --- 函式：讀取並前處理影像 ---
def load_and_preprocess_images(root_dir):
    images, labels = [], []
    for class_name in os.listdir(root_dir):
        class_dir = os.path.join(root_dir, class_name)
        if not os.path.isdir(class_dir): continue
        for fname in os.listdir(class_dir):
            if not fname.lower().endswith(('.jpg','.png')): continue
            path = os.path.join(class_dir, fname)
            img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            img = cv2.resize(img, IMAGE_SIZE)
            clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP)
            img = clahe.apply(img)
            images.append(img)
            labels.append(class_name)
    # 增加 channel 維度並轉為 numpy
    X = np.expand_dims(np.array(images), axis=-1).astype('float32') / 255.0
    return X, np.array(labels)

# --- 載入資料 ---
X_train, y_train = load_and_preprocess_images(TRAIN_DIR)
X_valid, y_valid = load_and_preprocess_images(VALID_DIR)
X_test,  y_test  = load_and_preprocess_images(TEST_DIR)

# --- 標籤編碼 + one-hot ---
le = LabelEncoder()
y_train_num = le.fit_transform(y_train)
y_valid_num = le.transform(y_valid)
y_test_num  = le.transform(y_test)

y_train_oh = to_categorical(y_train_num, num_classes=len(le.classes_))
y_valid_oh = to_categorical(y_valid_num, num_classes=len(le.classes_))
y_test_oh  = to_categorical(y_test_num,  num_classes=len(le.classes_))

# --- 建立資料增強器 ---
datagen = ImageDataGenerator(
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    fill_mode='nearest'
)

# --- 建立 CNN 模型 ---
model = models.Sequential([
    layers.Conv2D(32, (3,3), activation='relu', input_shape=(*IMAGE_SIZE,1)),
    layers.MaxPooling2D((2,2)),
    layers.Conv2D(64, (3,3), activation='relu'),
    layers.MaxPooling2D((2,2)),
    layers.Conv2D(128,(3,3), activation='relu'),
    layers.MaxPooling2D((2,2)),
    layers.Flatten(),
    layers.Dense(256, activation='relu'),
    layers.Dropout(0.5),
    layers.Dense(len(le.classes_), activation='softmax')
])

model.compile(optimizer='adam',
              loss='categorical_crossentropy',
              metrics=['accuracy'])

# --- 訓練 ---
history = model.fit(
    datagen.flow(X_train, y_train_oh, batch_size=BATCH_SIZE),
    steps_per_epoch=len(X_train)//BATCH_SIZE,
    epochs=EPOCHS,
    validation_data=(X_valid, y_valid_oh),
    shuffle=True
)

# --- 評估與儲存 ---
test_loss, test_acc = model.evaluate(X_test, y_test_oh, verbose=2)
print(f"Test accuracy: {test_acc:.4f}")

model.save("cnn_model.h5")
with open("label_encoder.pkl", "wb") as f:
    pickle.dump(le, f)

print("模型與編碼器已存檔為 cnn_model.h5、label_encoder.pkl")
