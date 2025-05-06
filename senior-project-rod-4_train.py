#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
train_local_abs.py

用途：
  - 读取本地 data.yaml
  - 对 train/val/valid/test 路径做智能“绝对化”处理
  - 用 Ultralytics YOLO API 训练物件检测模型
"""

import os
import sys
import yaml
import torch
from ultralytics import YOLO

# === 用户可修改区域 ===
ORIG_YAML  = "senior project-ROD.v4i.coco-segmentation/data.yaml"  # data.yaml 路径
MODEL_ARCH = "yolo11s-seg.pt"                     # yolo11n.pt|yolo11s.pt|yolo11m.pt…
EPOCHS     = 50
IMGSZ      = 640
BATCH_SIZE = 16
PROJECT    = "SeniorRod"
NAME       = "yolov11_v4"
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"
# ========================

def resolve_path(base_dir: str, rel: str) -> str:
    """
    1. 先試 direct = abspath(base_dir + rel)
       如果 exists → return direct
    2. 否則 strip = rel.lstrip('./')
       再試 alt = abspath(base_dir + strip)
       如果 exists → return alt
    3. 否则报错
    """
    direct = os.path.abspath(os.path.join(base_dir, rel))
    if os.path.exists(direct):
        return direct
    # 去掉开头所有 . 和 /
    stripped = rel.lstrip('./')
    alt = os.path.abspath(os.path.join(base_dir, stripped))
    if os.path.exists(alt):
        return alt
    raise FileNotFoundError(f"路徑解析失敗：{rel} → {direct} / {alt}")

def make_absolute_data_yaml(orig_yaml: str) -> str:
    base_dir = os.path.dirname(os.path.abspath(orig_yaml))
    with open(orig_yaml, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)

    for key in ("train", "val", "valid", "test"):
        if key in data:
            data[key] = resolve_path(base_dir, data[key])

    new_yaml = os.path.join(base_dir, "data_abs.yaml")
    with open(new_yaml, 'w', encoding='utf-8') as f:
        yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True)

    return new_yaml

def main():
    if not os.path.isfile(ORIG_YAML):
        print(f"ERROR: 找不到 {ORIG_YAML}", file=sys.stderr)
        sys.exit(1)

    # 1. 生成絕對路徑版 data.yaml
    abs_yaml = make_absolute_data_yaml(ORIG_YAML)
    print(f"生成絕對路徑 data.yaml：{abs_yaml}")

    # 2. 打印训练配置
    print("=== 训练配置 ===")
    print(f" data_yaml: {abs_yaml}")
    print(f" model    : {MODEL_ARCH}")
    print(f" epochs   : {EPOCHS}")
    print(f" imgsz    : {IMGSZ}")
    print(f" batch    : {BATCH_SIZE}")
    print(f" device   : {DEVICE}")
    print(f" output   : runs/{PROJECT}/{NAME}")
    print("================\n")

    # 3. 載入 segmentation 預訓練權重
    model = YOLO(MODEL_ARCH, task="segment")

    # 4. 開始 training（微調）
    model.train(
        data     = abs_yaml,
        epochs   = EPOCHS,
        imgsz    = IMGSZ,
        batch    = BATCH_SIZE,
        project  = PROJECT,
        name     = NAME,
        device   = DEVICE,
        exist_ok = True,
        task     = "segment",    # 這行最重要
        plots    = True
    )


    # 4. 输出最终权重位置
    best = os.path.join(
        os.path.dirname(abs_yaml),
        "runs", PROJECT, NAME, "weights", "best.pt"
    )
    print(f"\n訓練完成！最佳權重保存在：{best}")

if __name__ == "__main__":
    main()

# first training-----------------------------------------------------------------------------------
# Validating SeniorRod\yolov11_v4\weights\best.pt...
# Ultralytics 8.3.125  Python-3.12.7 torch-2.6.0+cpu CPU (AMD Ryzen 9 4900HS with Radeon Graphics)
# YOLO11s summary (fused): 100 layers, 9,413,961 parameters, 0 gradients, 21.3 GFLOPs
#                  Class     Images  Instances      Box(P          R      mAP50  mAP50-95): 100%|██████████| 2/2 [00:07<00:00,  3.67s/it]
#                    all         44        119      0.654      0.573      0.583      0.396
#            Road-Object         41         62       0.82       0.71      0.745      0.597
#                  floor         27         36      0.342      0.389       0.36       0.24
#                 people          9         21      0.801      0.619      0.644      0.351
# Speed: 1.7ms preprocess, 153.4ms inference, 0.0ms loss, 0.5ms postprocess per image--------------