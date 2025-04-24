# reorganize_all_splits.py
import os, json, shutil
from collections import defaultdict

BASE_DIR = "Senior-Design-VIAD-4"
SPLITS   = ["train", "valid", "test"]
OUT_BASE = os.path.join(BASE_DIR, "reorganized")

for split in SPLITS:
    src_dir   = os.path.join(BASE_DIR, split)
    json_path = os.path.join(src_dir, "_annotations.coco.json")
    out_split = os.path.join(OUT_BASE, split)

    # 讀 COCO 註解
    with open(json_path, "r", encoding="utf-8") as f:
        coco = json.load(f)

    # 建映射：image_id → list of category_id
    annos = defaultdict(list)
    for ann in coco["annotations"]:
        annos[ann["image_id"]].append(ann["category_id"])

    # 建映射：category_id → category_name
    cat_map = {c["id"]: c["name"] for c in coco["categories"]}

    # 依每張圖的第一個標註進行分類
    for img in coco["images"]:
        img_id  = img["id"]
        fname   = img["file_name"]
        cats    = annos.get(img_id, [])
        if not cats:
            continue
        label   = cat_map[cats[0]]
        src_img = os.path.join(src_dir, fname)
        dst_dir = os.path.join(out_split, label)
        dst_img = os.path.join(dst_dir, fname)

        os.makedirs(dst_dir, exist_ok=True)
        shutil.copy(src_img, dst_img)

    print(f"[{split}] 完成 → {out_split}")

print("全部切割資料夾已重組完畢。")
