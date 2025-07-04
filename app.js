let mediaList = [], directoryHandle = null;
let singlePlayMode = false;
let loopMode = false;

function toggleSinglePlay() {
  singlePlayMode = !singlePlayMode;
  document.getElementById("singleModeBtn").textContent = singlePlayMode ? "✅ 單次播放" : "🔁 單次播放";
}

function toggleLoop() {
  loopMode = !loopMode;
  document.getElementById("loopModeBtn").textContent = loopMode ? "✅ 單曲循環" : "🔂 單曲循環";
  const current = document.querySelector(".track.playing audio, .track.playing video");
  if (current) current.loop = loopMode;
}

function updateStatus(msg) {
  document.getElementById("statusMsg").textContent = msg;
}

function handleFiles(files) {
  [...files].forEach(file => {
    const media = document.createElement(file.type.includes("video") ? "video" : "audio");
    media.src = URL.createObjectURL(file);
    media.controls = true;
    media.volume = 1;
    mediaList.push({ file, media });
  });
  refreshPlaylist();
}

async function pickFolder() {
  try {
    directoryHandle = await window.showDirectoryPicker();
    if (await verifyPermission(directoryHandle)) {
      await saveHandle(directoryHandle);
      await loadFromDirectory(directoryHandle);
      updateStatus("資料夾已授權並載入音樂");
    }
  } catch (err) {
    updateStatus("選擇資料夾失敗");
  }
}

async function loadFromDirectory(handle) {
  mediaList = [];
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === 'file' && /\.(mp3|mp4|m4a)$/i.test(name)) {
      const file = await entry.getFile();
      const media = document.createElement(file.type.includes("video") ? "video" : "audio");
      media.src = URL.createObjectURL(file);
      media.controls = true;
      media.volume = 1;
      mediaList.push({ file, media });
    }
  }
  refreshPlaylist();
}

function refreshPlaylist() {
  const container = document.getElementById("playlist");
  container.innerHTML = "";
  mediaList.forEach((item, i) => {
    const div = document.createElement("div");
    div.className = "track";
    div.innerHTML = `<div class="number">${String(i + 1).padStart(2, '0')}</div>`;
    const title = document.createElement("div");
    title.textContent = item.file.name;

    const playBtn = document.createElement("button");
    playBtn.textContent = "▶ 播放";
    playBtn.className = "play";
    playBtn.onclick = () => {
      pauseAll();
      item.media.loop = loopMode;
      item.media.play();
      div.classList.add("playing");
    };

    const pauseBtn = document.createElement("button");
    pauseBtn.textContent = "⏸ 暫停";
    pauseBtn.onclick = () => item.media.pause();

    const stopBtn = document.createElement("button");
    stopBtn.textContent = "⏹ 停止";
    stopBtn.onclick = () => {
      item.media.pause();
      item.media.currentTime = 0;
      div.classList.remove("playing");
    };

    const bgBtn = document.createElement("button");
    bgBtn.textContent = "🎧 背景";
    let bgMode = false;
    bgBtn.onclick = () => {
      bgMode = !bgMode;
      bgBtn.textContent = bgMode ? "✅ 背景" : "🎧 背景";
      let targetVolume = bgMode ? 0.20 : 1.0;
      let step = (targetVolume - item.media.volume) / 10;
      let count = 0;
      const fade = setInterval(() => {
        if (count++ >= 10) {
          item.media.volume = targetVolume;
          clearInterval(fade);
        } else {
          item.media.volume += step;
        }
      }, 50);
    };

    const upBtn = document.createElement("button");
    upBtn.textContent = "⬆ 上移";
    upBtn.onclick = () => {
      if (i > 0) {
        [mediaList[i - 1], mediaList[i]] = [mediaList[i], mediaList[i - 1]];
        refreshPlaylist();
      }
    };

    const downBtn = document.createElement("button");
    downBtn.textContent = "⬇ 下移";
    downBtn.onclick = () => {
      if (i < mediaList.length - 1) {
        [mediaList[i], mediaList[i + 1]] = [mediaList[i + 1], mediaList[i]];
        refreshPlaylist();
      }
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑 刪除";
    deleteBtn.onclick = () => {
      item.media.pause();
      mediaList.splice(i, 1);
      refreshPlaylist();
    };

    const timeDisplay = document.createElement("div");
    timeDisplay.className = "time";
    item.media.ontimeupdate = () => {
      const t = item.media.currentTime;
      timeDisplay.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    };

    item.media.onplay = () => {
      document.querySelectorAll(".track").forEach(el => el.classList.remove("playing"));
      div.classList.add("playing");
      item.media.loop = loopMode;
    };

    item.media.onended = () => {
      div.classList.remove("playing");
      if (!singlePlayMode) {
        const next = mediaList[i + 1];
        if (next) {
          pauseAll();
          next.media.loop = loopMode;
          next.media.play();
          document.querySelectorAll(".track")[i + 1].classList.add("playing");
        }
      }
    };

    const btnGroup = document.createElement("div");
    btnGroup.className = "buttons";
    btnGroup.appendChild(playBtn);
    btnGroup.appendChild(pauseBtn);
    btnGroup.appendChild(stopBtn);
    btnGroup.appendChild(downBtn);
    btnGroup.appendChild(upBtn);
    btnGroup.appendChild(bgBtn);
    btnGroup.appendChild(deleteBtn);

    div.appendChild(title);
    div.appendChild(item.media);
    div.appendChild(btnGroup);
    div.appendChild(timeDisplay);
    container.appendChild(div);
  });
}

function pauseAll() {
  document.querySelectorAll("audio, video").forEach(m => m.pause());
  document.querySelectorAll(".track").forEach(d => d.classList.remove("playing"));
}

function toggleDarkMode() {
  document.body.style.background = document.body.style.background === "black" ? "#f2f2f2" : "black";
  document.body.style.color = document.body.style.color === "white" ? "black" : "white";
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("music-player-db", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("handles");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveHandle(handle) {
  const db = await openDB();
  const tx = db.transaction("handles", "readwrite");
  tx.objectStore("handles").put(handle, "directoryHandle");
  return new Promise(res => tx.oncomplete = res);
}

async function getHandle() {
  const db = await openDB();
  const tx = db.transaction("handles", "readonly");
  return new Promise((resolve, reject) => {
    const req = tx.objectStore("handles").get("directoryHandle");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function verifyPermission(handle) {
  const options = { mode: "read" };
  return (await handle.queryPermission(options)) === "granted" || 
         (await handle.requestPermission(options)) === "granted";
}

async function tryRestoreHandle() {
  try {
    const handle = await getHandle();
    if (handle && await verifyPermission(handle)) {
      directoryHandle = handle;
      await loadFromDirectory(handle);
      updateStatus("資料夾已還原，拖放音樂或選擇資料夾");
    } else {
      updateStatus("請點選右上方📁選擇資料夾");
    }
  } catch {
    updateStatus("請點選右上方📁選擇資料夾");
  }
}

window.addEventListener("DOMContentLoaded", tryRestoreHandle);

const filePicker = document.getElementById("filePicker");
const clickableText = document.querySelector("#dropzone .clickable");
const dropzone = document.getElementById("dropzone");

clickableText.addEventListener("click", e => {
  e.stopPropagation();
  filePicker.click();
});
filePicker.addEventListener("change", () => handleFiles(filePicker.files));

["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
  dropzone.addEventListener(eventName, e => e.preventDefault());
});

dropzone.addEventListener("dragover", () => {
  dropzone.style.background = "#ffe5e5";
});
dropzone.addEventListener("dragleave", () => {
  dropzone.style.background = "#fff5f5";
});
dropzone.addEventListener("drop", e => {
  handleFiles(e.dataTransfer.files);
  dropzone.style.background = "#fff5f5";
});
// ✅ 註冊 service-worker 以支援 PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(registration => {
        console.log('✅ Service Worker 已註冊:', registration.scope);
      })
      .catch(error => {
        console.error('❌ Service Worker 註冊失敗:', error);
      });
  });
}
