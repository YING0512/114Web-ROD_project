import os
from roboflow import Roboflow

# 替換成你的 Roboflow API key
# 你可以在 Roboflow 網站的 Settings -> Roboflow API 找到
ROBOFLOW_API_KEY = "YOUR_ROBOFLOW_API_KEY"

# 替換成你的 Roboflow 專案資訊
WORKSPACE = "ying-ijjie"
PROJECT = "senior-project-rod"
VERSION = 8  # 請確保這是你的資料集版本

# 指定下載格式為 segmentation
# 使用 yolov8 格式，它會產生包含 images 和 labels 資料夾的結構
DOWNLOAD_FORMAT = "yolov8"

# 指定資料集下載路徑
DOWNLOAD_DIR = "segmentation_dataset"

try:
    print(f"🚀 連接到 Roboflow 工作空間: {WORKSPACE}...")
    rf = Roboflow(api_key=ROBOFLOW_API_KEY)
    workspace = rf.workspace(WORKSPACE)
    print(f"✅ 已連接到工作空間: {WORKSPACE}")

    print(f"🚀 連接到 Roboflow 專案: {PROJECT}...")
    project = workspace.project(PROJECT)
    print(f"✅ 已連接到專案: {PROJECT}")

    print(f"🚀 下載資料集版本: {VERSION}，格式: {DOWNLOAD_FORMAT}...")
    dataset = project.version(VERSION).download(DOWNLOAD_FORMAT, location=DOWNLOAD_DIR)
    print(f"✅ 資料集下載完成至: {os.path.abspath(DOWNLOAD_DIR)}")

except Exception as e:
    print(f"❌ 下載資料集時發生錯誤: {e}")