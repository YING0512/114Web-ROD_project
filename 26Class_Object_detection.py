#CNN MODEL IN PREPROCESS CODE WITH PREDICTED RESULT
#程式截自 https://www.kaggle.com/code/ahmnazmul/object-detection
import os
import cv2
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import tensorflow as tf
from keras import layers, models
to_categorical      = tf.keras.utils.to_categorical
ImageDataGenerator = tf.keras.preprocessing.image.ImageDataGenerator
from matplotlib import pyplot as plt

# FUNCTION TO LOAD AND PREPROESS IMAGES
# 載入並前處理影像的函式
def load_and_preprocess_images(directory, label, image_size=(128, 128), clahe_clip_limit=2.0):
    images = []
    labels = []

    for filename in os.listdir(directory):
        if filename.endswith(".jpg"):
            file_path = os.path.join(directory, filename)
            img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
            img = cv2.resize(img, image_size)

            # Apply CLAHE
            # 套用 CLAHE（對比度限制自適應直方圖等化）
            clahe = cv2.createCLAHE(clipLimit=clahe_clip_limit)
            img = clahe.apply(img)

            images.append(img)
            labels.append(label)

    return images, labels

# DATA PATH
# 資料路徑
train_path = "Senior-Design-VIAD-4/train"
test_path = "Senior-Design-VIAD-4/test"

# LOAD AND PREPROCESS IAMGE DATA
# 載入並前處理影像資料
train_images, train_labels = load_and_preprocess_images(train_path, label="train")
test_images, test_labels = load_and_preprocess_images(test_path, label="test")

# ENSURE ALL NUMBER OF IMAGES HAS SAME DIMENSION
# 確保所有影像具有相同維度（若為灰階則在最後加一個 channel）
def reshape_images(images):
    return [img if len(img.shape) == 3 else np.expand_dims(img, axis=-1) for img in images]

train_images = reshape_images(train_images)
test_images = reshape_images(test_images)

# STORE IMAGES AND LABEL I LIST
# 將影像與標籤存入列表
all_images = train_images + test_images
all_labels = train_labels + test_labels

# CONVERT LIST TO NUMPY ARRAYS
# 轉換列表為 NumPy 陣列
images = np.array(all_images)
labels = np.array(all_labels)

# CONVERT LABELS TO NUMERIC FORMAT
# 將標籤轉換為數值格式
label_encoder = LabelEncoder()
numeric_labels = label_encoder.fit_transform(labels)

# CONVERT LABELS TO ONE HOT ENCODING
# 將標籤轉換為一熱編碼
one_hot_labels = to_categorical(numeric_labels, num_classes=26)

# NORMALIZE PIXEL 
# 正規化像素值（0–1）
images = images / 255.0

# SPLIT DATA INTO TRAING AND TESTING SET
# 將資料切分為訓練集與測試集
X_train, X_test, y_train, y_test = train_test_split(images, one_hot_labels, test_size=0.2, random_state=42)

# DATA AUGMENTATION
# 資料增強設定
datagen = ImageDataGenerator(
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    fill_mode='nearest'
)

# CNN MODEL
# 建立 CNN 模型
model = models.Sequential()
model.add(layers.Conv2D(32, (3, 3), activation='relu', input_shape=(128, 128, 1)))
model.add(layers.MaxPooling2D((2, 2)))
model.add(layers.Conv2D(64, (3, 3), activation='relu'))
model.add(layers.MaxPooling2D((2, 2)))
model.add(layers.Conv2D(128, (3, 3), activation='relu'))
model.add(layers.MaxPooling2D((2, 2)))
model.add(layers.Flatten())
model.add(layers.Dense(256, activation='relu'))
model.add(layers.Dropout(0.5))
model.add(layers.Dense(26, activation='softmax'))

# COMPLIE THE MODEL
# 編譯模型
model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])

# TRAIN THE MODEL
# 訓練參數
batch_size = 32
epochs = 10

history = model.fit(datagen.flow(X_train, y_train, batch_size=batch_size),
                    steps_per_epoch=len(X_train) // batch_size,
                    epochs=epochs,
                    validation_data=(X_test, y_test),
                    shuffle=True)

# EVALUATE THE MODEL ON TEST SET
# 在測試集上評估模型
test_loss, test_acc = model.evaluate(X_test, y_test, verbose=2)
print(f"Test accuracy: {test_acc}")

# SHOW TRAIN HISTORY
# 繪製訓練過程的準確率曲線
plt.plot(history.history['accuracy'], label='accuracy')
plt.plot(history.history['val_accuracy'], label='val_accuracy')
plt.xlabel('Epoch')
plt.ylabel('Accuracy')
plt.legend(loc='lower right')
plt.show()

# MAKE PREDICTION ON A FEW TEST IMAGE
# 對前 4 張測試圖像做預測
predictions = model.predict(X_test[:4])

# SHOW THE ORGINAL AND PREDICTED LABEL ON TEST IMAGES
# 顯示原始與預測標籤
class_names = label_encoder.classes_
predicted_labels = [class_names[np.argmax(pred)] for pred in predictions]

fig, axes = plt.subplots(1, 4, figsize=(12, 3))
for i in range(4):
    axes[i].imshow(X_test[i].reshape(128, 128), cmap='gray')
    axes[i].set_title(f"True: {class_names[np.argmax(y_test[i])]}\nPredicted: {predicted_labels[i]}")
    axes[i].axis('off')
plt.show()

# FUNCTION TO LOAD AND PREPROCESS IMAGE
# # 顯示訓練集中的前4張影像範例
def load_and_preprocess_images(directory, label, image_size=(128, 128), clahe_clip_limit=2.0):
    images = []
    labels = []

    for filename in os.listdir(directory):
        if filename.endswith(".jpg"):
            file_path = os.path.join(directory, filename)
            img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
            img = cv2.resize(img, image_size)

            # Apply CLAHE (CONTRAST LIMITED ADAPTIVE HISTOGRAM EQUALIZATION)
            # 套用 CLAHE（對比度限制自適應直方圖等化）
            clahe = cv2.createCLAHE(clipLimit=clahe_clip_limit)
            img = clahe.apply(img)

            images.append(img)
            labels.append(label)

    return images, labels

# DATAPATH
# 資料路徑
test_path = "Senior-Design-VIAD-4/test"
train_path = "Senior-Design-VIAD-4/train"
valid_path = "Senior-Design-VIAD-4/valid"

# LOAD AND PREPROCESS IMAGE DATA
# 載入並前處理影像資料
train_images, train_labels = load_and_preprocess_images(train_path, label="train")
test_images,  test_labels = load_and_preprocess_images(test_path, label="test")

# ENSURE ALL IMAGES HAVE THE SAME NUMBER OF DIMENSIONS (3 for RGB, 2 for grayscale)
# 確保所有影像具有相同維度（3維代表RGB，2維代表灰階）
def reshape_images(images):
    return [img if len(img.shape) == 3 else np.expand_dims(img, axis=-1) for img in images]

train_images = reshape_images(train_images)
test_images = reshape_images(test_images)

# STORE IMAGES AND LABEL IN LISTS 
# 將影像與標籤存入列表
all_images = train_images + test_images
all_labels = train_labels + test_labels

# CONVERT LISTS TO NUMPY ARRAY 
# 轉換列表為 NumPy 陣列
images = np.array(all_images)
labels = np.array(all_labels)

# CONVERT LABELS TO NUMERIC FORMAT
# 將標籤轉換為數值格式
label_encoder = LabelEncoder()
numeric_labels = label_encoder.fit_transform(labels)

#CONVERT LABELS TO ONE-HOT ENCODING
# 將標籤轉換為一熱編碼
one_hot_labels = to_categorical(numeric_labels)

# NORMALIZE AND PIXEL VALUES
# 正規化像素值（0–1）
images = images / 255.0

# SPLIT DATA INTO TRAIN AND TESTING SET
# 切分為訓練集與測試集
X_train, X_test, y_train, y_test = train_test_split(images, one_hot_labels, test_size=0.2, random_state=42)

# DATA AUGMENTATION
# 資料增強設定
datagen = ImageDataGenerator(
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    fill_mode='nearest'
)

# FUNCTION TO DISPLAY IMAGE 
# 顯示影像的函式
def show_images(images, labels, num_images=4):
    fig, axes = plt.subplots(1, num_images, figsize=(12, 3))

    for i in range(num_images):
        axes[i].imshow(images[i], cmap='gray')  
        axes[i].set_title(labels[i])
        axes[i].axis('off')

    plt.show()

# SHOW 4 IMAGES FROM THE TRAIN SET
# 顯示訓練集中前4張影像範例
show_images(train_images[:4], train_labels[:4], num_images=4)

# SHOW 4 IMAGES FROM THE TEST SET
# 印出資料形狀做確認
show_images(test_images[:4], test_labels[:4], num_images=4)

print("Shape of X_train:", X_train.shape)
print("Shape of y_train:", y_train.shape)
print("Shape of X_test:", X_test.shape)
print("Shape of y_test:", y_test.shape)