/* 뭐따지? Korean/English browser-only OCR adapter.
 * OCR libraries/language data are downloaded from CDNs only when user clicks.
 * The selected image is passed to a local browser WebWorker, not our server.
 */
(function () {
  "use strict";
  const fileInput = document.getElementById("job-file");
  const textInput = document.getElementById("job-text");
  const button = document.getElementById("ocr-button");
  const status = document.getElementById("ocr-progress");
  if (!fileInput || !textInput || !button || !status) return;

  let libraryPromise = null;
  let workerPromise = null;
  let busy = false;
  const reviewer = window.MuttajiOcrReview && window.MuttajiOcrReview.createUI();

  function library() {
    if (window.Tesseract && typeof window.Tesseract.createWorker === "function") {
      return Promise.resolve(window.Tesseract);
    }
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.0/dist/tesseract.min.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = function () {
        if (window.Tesseract && typeof window.Tesseract.createWorker === "function") resolve(window.Tesseract);
        else reject(new Error("OCR 프로그램 초기화에 실패했습니다."));
      };
      script.onerror = function () {
        reject(new Error("OCR 프로그램을 내려받지 못했습니다. 네트워크를 확인해 주세요."));
      };
      document.head.appendChild(script);
    }).catch(function (error) {
      libraryPromise = null;
      throw error;
    });
    return libraryPromise;
  }

  function worker() {
    if (!workerPromise) {
      workerPromise = library().then(function (tesseract) {
        return tesseract.createWorker(["kor", "eng"], 1, {
          logger: function (info) {
            if (!busy || !info || !info.status) return;
            const pct = typeof info.progress === "number" ? " " + Math.round(info.progress * 100) + "%" : "";
            status.textContent = "글자 추출: " + info.status + pct;
          }
        });
      }).catch(function (error) {
        workerPromise = null;
        throw error;
      });
    }
    return workerPromise;
  }

  fileInput.addEventListener("change", function () {
    if (reviewer) reviewer.reset();
    const file = fileInput.files && fileInput.files[0];
    button.disabled = busy || !file ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024;
    status.textContent = button.disabled && !busy
      ? "이미지를 선택해 주세요 (PNG/JPG/WEBP, 최대 8MB)."
      : file ? "이미지 선택 완료. 버튼을 눌러 글자를 추출하세요." : status.textContent;
  });

  button.addEventListener("click", async function () {
    const image = fileInput.files && fileInput.files[0];
    if (!image || busy || !["image/png", "image/jpeg", "image/webp"].includes(image.type) || image.size > 8 * 1024 * 1024) return;
    busy = true;
    button.disabled = true;
    status.textContent = "한글·영문 OCR 프로그램과 언어 데이터 준비 중...";
    try {
      const engine = await worker();
      if (typeof engine.setParameters === "function") {
        // Single text column per crop; do not read four table cells as one paragraph.
        await engine.setParameters({
          tessedit_pageseg_mode: "4",
          preserve_interword_spaces: "1"
        });
      }
      status.textContent = "표와 여백을 분석하여 글자 인식 영역을 준비 중...";
      const prepared = window.MuttajiOcrImage
        ? await window.MuttajiOcrImage.prepare(image)
        : {regions:[image],columns:1,cropped:false};
      const parts = [];
      for (let idx=0; idx<prepared.regions.length; idx++) {
        status.textContent = "글자 추출 중: " + (idx+1) + "/" + prepared.regions.length +
          (prepared.columns>1?"번째 표 열":"개 영역");
        const result = await engine.recognize(prepared.regions[idx]);
        const part = String(result && result.data && result.data.text || "").trim();
        parts.push(part);
      }
      if (!fileInput.files || fileInput.files[0] !== image) {
        status.textContent = "선택한 이미지가 바뀌어 이전 글자 추출 결과를 적용하지 않았습니다.";
        return;
      }
      const extracted = parts.join("\n\n").trim();
      if (!extracted) {
        status.textContent = "읽어낸 글자가 없습니다. 원본 이미지를 선명하게 다시 캡처하거나 텍스트를 직접 입력해 주세요.";
        return;
      }
      // Never silently turn column position into a verified job requirement.
      // The user explicitly edits & confirms each OCR column before classification.
      if(!reviewer){
        status.textContent="OCR 검토 화면을 불러오지 못했습니다. 페이지를 새로고침해 주세요.";
        return;
      }
      reviewer.show(parts);
      status.textContent = "총 "+parts.filter(Boolean).length+"개 열에서 "+extracted.length+"자를 읽었습니다. 아래에서 잘못된 글자와 담당업무·필수·우대 분류를 수정한 뒤 적용해 주세요.";
      const panel=document.getElementById("ocr-review");
      if(panel&&typeof panel.scrollIntoView==="function")panel.scrollIntoView({behavior:"smooth",block:"nearest"});
    } catch (error) {
      status.textContent = "글자 추출 실패: " + (error && error.message ? error.message : "OCR 처리에 실패했습니다.") + " 다시 시도하거나 텍스트를 직접 입력해 주세요.";
    } finally {
      busy = false;
      const current = fileInput.files && fileInput.files[0];
      button.disabled = !current || !["image/png", "image/jpeg", "image/webp"].includes(current.type) || current.size > 8 * 1024 * 1024;
    }
  });

  window.addEventListener("pagehide", function () {
    if (workerPromise) workerPromise.then(function (engine) { return engine.terminate(); }).catch(function () {});
  });
})();
