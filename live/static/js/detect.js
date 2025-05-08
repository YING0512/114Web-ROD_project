const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("output");
const resultBox = document.getElementById("result");

if (!navigator.mediaDevices?.getUserMedia) {
  alert("你的瀏覽器不支援相機存取。");
  throw new Error("getUserMedia not supported");
}

navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
  .then(stream => {
    video.srcObject = stream;
    video.play();
    setInterval(() => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      fetch("/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl })
      })
      .then(r => r.json())
      .then(data => {
        output.src = data.image;
        resultBox.innerText = data.result;
      })
      .catch(e => console.error("辨識錯誤：", e));
    }, 200);
  })
  .catch(err => console.error("無法啟用相機：", err));
