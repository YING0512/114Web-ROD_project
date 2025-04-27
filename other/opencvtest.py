import cv2 #匯入open cv
cap = cv2.VideoCapture(0)#建立視訊鏡頭
while True:#持續取得影像偵
    ret, frame = cap.read()
    cv2.imshow('Video', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
cap.release()#釋放資源
cv2.destroyAllWindows()#關閉視窗