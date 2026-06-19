import sys
import json
import os

try:
    from ultralytics import YOLO
except ImportError as e:
    print(json.dumps({"error": f"Failed to import ultralytics: {str(e)}"}))
    sys.exit(1)

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    targets = sys.argv[2].lower().split(',') if sys.argv[2] else []
    
    # script is in src/utils, so api root is ../..
    api_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    model_path = os.path.join(api_root, 'yolov8m.pt')
    
    try:
        model = YOLO(model_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to load model at {model_path}: {str(e)}"}))
        sys.exit(1)
        
    try:
        results = model(image_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to analyze image: {str(e)}"}))
        sys.exit(1)
        
    detected = []
    
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0]) * 100
            name = result.names[cls_id]
            detected.append({"object": name, "confidence": conf})
            
    print(json.dumps({"detected": detected}))

if __name__ == '__main__':
    main()
