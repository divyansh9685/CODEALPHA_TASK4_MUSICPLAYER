// ================================================================
//  PREMIUM MUSIC PLAYER — Full Implementation
//  Song sources replaced with song1.mp3 … song6.mp3
// ================================================================

// ---------- CONSTANTS ----------
const DEFAULT_SONGS = [
    { id: 1, title: 'Song One', artist: 'Artist 1', genre: 'Pop', url: 'song1.mp3', duration: 0 },
    { id: 2, title: 'Song Two', artist: 'Artist 2', genre: 'Rock', url: 'song2.mp3', duration: 0 },
    { id: 3, title: 'Song Three', artist: 'Artist 3', genre: 'Jazz', url: 'song3.mp3', duration: 0 },
    { id: 4, title: 'Song Four', artist: 'Artist 4', genre: 'Electronic', url: 'song4.mp3', duration: 0 },
    { id: 5, title: 'Song Five', artist: 'Artist 5', genre: 'Hip-Hop', url: 'song5.mp3', duration: 0 },
    { id: 6, title: 'Song Six', artist: 'Artist 6', genre: 'Classical', url: 'song6.mp3', duration: 0 }
];

const GENRES = ['Pop', 'Rock', 'Jazz', 'Electronic', 'Hip-Hop', 'Classical', 'Other'];

// ---------- STATE ----------
let playlist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffled = false;
let repeatMode = 'none'; // 'none' | 'all' | 'one'
let playbackSpeed = 1.0;
let crossfadeEnabled = false;
let nextId = 100;
let sleepTimerId = null;
let sleepTimeoutId = null;
let alarmTimeoutId = null;
let alarmTime = null;
let currentTheme = 'dark';
let isMiniVisible = false;
let isQueueOpen = false;

let stats = {
    totalListenTime: 0,
    songPlays: {},
    artistPlays: {},
    genrePlays: {},
    dailyPlays: {},
    weeklyData: [0,0,0,0,0,0,0],
    lastPlayDate: null,
};

// ---------- DOM REFS ----------
const $ = (id) => document.getElementById(id);
const audio = new Audio();

const playBtn = $('playBtn');
const prevBtn = $('prevBtn');
const nextBtn = $('nextBtn');
const shuffleBtn = $('shuffleBtn');
const repeatBtn = $('repeatBtn');
const progressFill = $('progressFill');
const progressWrapper = $('progressWrapper');
const currentTimeEl = $('currentTime');
const totalDurationEl = $('totalDuration');
const songTitle = $('songTitle');
const songArtist = $('songArtist');
const volumeSlider = $('volumeSlider');
const volLabel = $('volLabel');
const albumArt = $('albumArt');
const waveLoading = $('waveLoading');
const toast = $('toast');
const queueList = $('queueList');
const queueCount = $('queueCount');
const queueToggle = $('queueToggle');
const miniPlayer = $('miniPlayer');
const miniTitle = $('miniTitle');
const miniArtist = $('miniArtist');
const miniPlay = $('miniPlay');
const miniPrev = $('miniPrev');
const miniNext = $('miniNext');
const themePanel = $('themePanel');
const themeSelector = $('themeSelector');
const themeBtn = $('themeBtn');
const fileInput = $('fileInput');
const importInput = $('importInput');

const statTotalTime = $('statTotalTime');
const statFavoriteArtist = $('statFavoriteArtist');
const statFavoriteGenre = $('statFavoriteGenre');
const statToday = $('statToday');
const weeklyGraph = $('weeklyGraph');
const monthlyReport = $('monthlyReport');

const sleepModal = $('sleepModal');
const alarmModal = $('alarmModal');
const sleepStatus = $('sleepStatus');
const alarmStatus = $('alarmStatus');
const alarmTimeInput = $('alarmTime');
const alarmSongSelect = $('alarmSongSelect');

const sleepBtn = $('sleepBtn');
const alarmBtn = $('alarmBtn');
const pipBtn = $('pipBtn');
const miniToggle = $('miniToggle');
const exportBtn = $('exportBtn');
const importBtn = $('importBtn');
const clearQueueBtn = $('clearQueueBtn');
const syncBtn = $('syncBtn');
const crossfadeIndicator = $('crossfadeIndicator');
const addSongsBtn = $('addSongsBtn');

// ---------- HELPERS ----------
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
function formatTimeLong(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${Math.floor(seconds % 60)}s`;
    return `${Math.floor(seconds)}s`;
}
function formatDate(date) { return date.toISOString().split('T')[0]; }
function getDayName(index) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const d = new Date(); d.setDate(d.getDate() - (6 - index));
    return days[d.getDay()];
}
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function showToast(msg, duration = 2500) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}
function getRandomId() { return nextId++; }

// ---------- STORAGE ----------
function saveToLocalStorage() {
    try {
        const data = {
            playlist: playlist.map(s => ({ ...s, _blobUrl: undefined })),
            currentIndex, isShuffled, repeatMode, playbackSpeed, stats,
            currentTheme, volume: audio.volume, crossfadeEnabled,
        };
        localStorage.setItem('musicPlayerData', JSON.stringify(data));
    } catch(e) { console.warn('Save localStorage failed', e); }
}
function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem('musicPlayerData');
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('MusicPlayerDB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('stats')) db.createObjectStore('stats', { keyPath: 'key' });
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}
async function saveToIndexedDB() {
    try {
        const db = await openIndexedDB();
        const tx = db.transaction(['songs','stats'], 'readwrite');
        const songStore = tx.objectStore('songs');
        const statsStore = tx.objectStore('stats');
        songStore.clear(); statsStore.clear();
        for (const song of playlist) {
            const s = { ...song, _blobUrl: undefined };
            songStore.add(s);
        }
        statsStore.add({ key: 'stats', ...stats });
        statsStore.add({ key: 'meta', currentIndex, isShuffled, repeatMode, playbackSpeed, currentTheme, crossfadeEnabled });
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
        db.close();
    } catch(e) { console.warn('IndexedDB save failed', e); }
}
async function loadFromIndexedDB() {
    try {
        const db = await openIndexedDB();
        const tx = db.transaction(['songs','stats'], 'readonly');
        const songStore = tx.objectStore('songs');
        const statsStore = tx.objectStore('stats');
        const songs = await new Promise(resolve => { const req = songStore.getAll(); req.onsuccess = () => resolve(req.result); });
        const statsData = await new Promise(resolve => { const req = statsStore.get('stats'); req.onsuccess = () => resolve(req.result); });
        const meta = await new Promise(resolve => { const req = statsStore.get('meta'); req.onsuccess = () => resolve(req.result); });
        db.close();
        return { songs, stats: statsData, meta };
    } catch(e) { return null; }
}

// ---------- EXPORT / IMPORT ----------
function exportPlaylist() {
    const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        playlist: playlist.map(s => ({ id:s.id, title:s.title, artist:s.artist, genre:s.genre||'Other', url:s.url, duration:s.duration })),
        stats
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `playlist_${formatDate(new Date())}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Playlist exported!');
}
function importPlaylist(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.playlist || !Array.isArray(data.playlist)) { showToast('Invalid playlist file'); return; }
            let added = 0;
            for (const song of data.playlist) {
                if (song.title && song.url) {
                    playlist.push({ id: getRandomId(), title: song.title, artist: song.artist||'Unknown', genre: song.genre||'Other', url: song.url, duration: song.duration||0 });
                    added++;
                }
            }
            if (added === 0) { showToast('No valid songs found'); return; }
            if (playlist.length === added) { currentIndex = 0; loadSong(0); }
            else { renderQueue(); if (!audio.src) { currentIndex = 0; loadSong(0); } }
            saveToLocalStorage(); saveToIndexedDB();
            showToast(`Imported ${added} songs!`);
        } catch(err) { showToast('Error importing: '+err.message); }
    };
    reader.readAsText(file);
}
function syncWithFirebase() {
    showToast('🔄 Syncing...');
    saveToLocalStorage(); saveToIndexedDB();
    setTimeout(() => showToast('✅ Sync complete (Local)'), 800);
}

// ---------- STATISTICS ----------
function updateStats(song) {
    if (!song) return;
    const today = formatDate(new Date());
    stats.songPlays[song.id] = (stats.songPlays[song.id]||0) + 1;
    if (song.artist) stats.artistPlays[song.artist] = (stats.artistPlays[song.artist]||0) + 1;
    if (song.genre) stats.genrePlays[song.genre] = (stats.genrePlays[song.genre]||0) + 1;
    stats.dailyPlays[today] = (stats.dailyPlays[today]||0) + 1;
    const now = new Date();
    for (let i=0; i<7; i++) {
        const d = new Date(now); d.setDate(d.getDate() - (6 - i));
        const key = formatDate(d);
        stats.weeklyData[i] = stats.dailyPlays[key] || 0;
    }
    stats.lastPlayDate = today;
    saveToLocalStorage(); saveToIndexedDB();
    renderStats();
}
function renderStats() {
    statTotalTime.textContent = formatTimeLong(stats.totalListenTime || 0);
    let bestArtist = '—', bestCount = 0;
    for (const [artist, count] of Object.entries(stats.artistPlays||{})) {
        if (count > bestCount) { bestCount = count; bestArtist = artist; }
    }
    statFavoriteArtist.textContent = bestArtist;
    let bestGenre = '—', bestGenreCount = 0;
    for (const [genre, count] of Object.entries(stats.genrePlays||{})) {
        if (count > bestGenreCount) { bestGenreCount = count; bestGenre = genre; }
    }
    statFavoriteGenre.textContent = bestGenre;
    const today = formatDate(new Date());
    statToday.textContent = stats.dailyPlays[today] || 0;
    renderWeeklyGraph();
    const now = new Date(); const month = now.getMonth(); const year = now.getFullYear();
    let monthTotal = 0, monthSongs = 0;
    for (const [date, count] of Object.entries(stats.dailyPlays||{})) {
        const d = new Date(date);
        if (d.getMonth() === month && d.getFullYear() === year) { monthTotal += count; monthSongs += count; }
    }
    monthlyReport.textContent = `Monthly: ${monthSongs} songs · ${formatTimeLong(stats.totalListenTime||0)}`;
}
function renderWeeklyGraph() {
    const max = Math.max(...stats.weeklyData, 1);
    let html = '';
    for (let i=0; i<7; i++) {
        const height = Math.max(4, (stats.weeklyData[i] / max) * 70);
        html += `<div class="bar" style="height:${height}px;"><span class="bar-label">${getDayName(i)}</span></div>`;
    }
    weeklyGraph.innerHTML = html;
}

// ---------- QUEUE ----------
function renderQueue() {
    if (playlist.length === 0) {
        queueList.innerHTML = `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:13px;">
            <i class="fas fa-music" style="font-size:20px;display:block;margin-bottom:8px;opacity:0.3;"></i>
            Queue is empty<br><span style="font-size:11px;">Add songs using the + button</span></div>`;
        queueCount.textContent = '0 songs';
        return;
    }
    let html = '';
    playlist.forEach((song, idx) => {
        const isActive = idx === currentIndex;
        const durationStr = song.duration ? formatTime(song.duration) : '--:--';
        html += `<div class="queue-item ${isActive?'active':''}" data-index="${idx}" draggable="true">
            <span class="q-index">${idx+1}</span>
            <span class="q-playing"><i class="fas fa-play"></i></span>
            <div class="q-info"><div class="q-title">${escapeHtml(song.title)}</div><div class="q-artist">${escapeHtml(song.artist)}</div></div>
            <span class="q-duration" style="font-size:11px;color:var(--text-muted);">${durationStr}</span>
            <span class="q-drag"><i class="fas fa-grip-vertical"></i></span>
            <button class="q-remove" data-index="${idx}"><i class="fas fa-times"></i></button>
        </div>`;
    });
    queueList.innerHTML = html;
    queueCount.textContent = `${playlist.length} song${playlist.length>1?'s':''}`;

    queueList.querySelectorAll('.queue-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.q-remove') || e.target.closest('.q-drag')) return;
            const idx = parseInt(el.dataset.index);
            if (!isNaN(idx) && idx !== currentIndex) playSong(idx);
            else if (idx === currentIndex) togglePlay();
        });
    });
    queueList.querySelectorAll('.q-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            removeSong(idx);
        });
    });

    let dragItem = null;
    queueList.querySelectorAll('.queue-item').forEach(el => {
        el.addEventListener('dragstart', (e) => {
            dragItem = parseInt(el.dataset.index);
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            document.querySelectorAll('.queue-item.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const target = parseInt(el.dataset.index);
            if (dragItem !== null && dragItem !== target) {
                document.querySelectorAll('.queue-item.drag-over').forEach(el => el.classList.remove('drag-over'));
                el.classList.add('drag-over');
            }
        });
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            const target = parseInt(el.dataset.index);
            if (dragItem !== null && dragItem !== target) reorderQueue(dragItem, target);
            el.classList.remove('drag-over');
        });
    });
}
function reorderQueue(from, to) {
    if (from < 0 || from >= playlist.length || to < 0 || to >= playlist.length) return;
    const [moved] = playlist.splice(from, 1);
    playlist.splice(to, 0, moved);
    if (currentIndex === from) currentIndex = to;
    else if (currentIndex > from && currentIndex <= to) currentIndex--;
    else if (currentIndex < from && currentIndex >= to) currentIndex++;
    renderQueue(); saveToLocalStorage(); showToast('Queue reordered');
}
function removeSong(index) {
    if (playlist.length <= 1) { showToast('Cannot remove the last song'); return; }
    if (index < 0 || index >= playlist.length) return;
    const wasCurrent = index === currentIndex;
    playlist.splice(index, 1);
    if (wasCurrent) {
        if (index >= playlist.length) currentIndex = playlist.length - 1;
        else currentIndex = index;
        if (audio.src) { loadSong(currentIndex); if (isPlaying) audio.play().catch(()=>{}); }
    } else if (index < currentIndex) currentIndex--;
    renderQueue(); saveToLocalStorage(); showToast('Song removed');
}
function clearQueue() {
    if (playlist.length === 0) return;
    if (confirm('Clear all songs from queue?')) {
        audio.pause(); isPlaying = false; updatePlayButton();
        playlist = []; currentIndex = 0; audio.src = '';
        songTitle.textContent = 'No song loaded'; songArtist.textContent = '—';
        miniTitle.textContent = 'No song'; miniArtist.textContent = '—';
        progressFill.style.width = '0%'; currentTimeEl.textContent = '0:00'; totalDurationEl.textContent = '0:00';
        renderQueue(); saveToLocalStorage(); showToast('Queue cleared');
    }
}

// ---------- AUDIO CONTROL ----------
function loadSong(index) {
    if (playlist.length === 0) return;
    if (index < 0) index = playlist.length - 1;
    if (index >= playlist.length) index = 0;
    currentIndex = index;
    const song = playlist[currentIndex];
    audio.src = song.url;
    audio.load();
    audio.playbackRate = playbackSpeed;
    songTitle.textContent = song.title || 'Untitled';
    songArtist.textContent = song.artist || 'Unknown Artist';
    miniTitle.textContent = song.title || 'Untitled';
    miniArtist.textContent = song.artist || 'Unknown Artist';
    const hue = (song.title.length * 37 + (song.artist||'').length * 17) % 360;
    albumArt.style.background = `linear-gradient(145deg, hsl(${hue}, 50%, 25%), hsl(${hue + 30}, 40%, 15%))`;
    renderQueue(); updatePlaylistScroll();
    totalDurationEl.textContent = '0:00'; currentTimeEl.textContent = '0:00'; progressFill.style.width = '0%';
    updateAlarmSongSelect();
    if (isPlaying) audio.play().catch(()=>{});
    saveToLocalStorage();
}
function playSong(index) {
    if (playlist.length === 0) { showToast('No songs in playlist'); return; }
    if (index !== undefined && index >= 0 && index < playlist.length) {
        if (isPlaying && crossfadeEnabled && audio.src) {
            const oldAudio = audio.cloneNode();
            oldAudio.volume = audio.volume;
            oldAudio.currentTime = audio.currentTime;
            oldAudio.play();
            const fadeOut = setInterval(() => {
                if (oldAudio.volume > 0.05) { oldAudio.volume -= 0.05; }
                else { oldAudio.pause(); clearInterval(fadeOut); }
            }, 50);
            currentIndex = index; loadSong(currentIndex);
            audio.volume = 0;
            audio.play().then(() => {
                const fadeIn = setInterval(() => {
                    if (audio.volume < 0.95) { audio.volume = Math.min(1, audio.volume + 0.05); }
                    else { clearInterval(fadeIn); }
                }, 50);
            });
            isPlaying = true; updatePlayButton();
            return;
        }
        currentIndex = index;
    }
    loadSong(currentIndex);
    audio.play().then(() => {
        isPlaying = true; updatePlayButton();
        updateStats(playlist[currentIndex]);
        if (!audio._listenInterval) {
            audio._listenInterval = setInterval(() => {
                if (isPlaying && !audio.paused) stats.totalListenTime = (stats.totalListenTime||0) + 1;
            }, 1000);
        }
    }).catch(() => { isPlaying = false; updatePlayButton(); showToast('Cannot play this song.'); });
    saveToLocalStorage();
}
function togglePlay() {
    if (playlist.length === 0) { showToast('No songs in playlist'); return; }
    if (audio.paused) {
        if (!audio.src || audio.ended) loadSong(currentIndex);
        audio.play().then(() => {
            isPlaying = true; updatePlayButton();
            if (!audio._listenInterval) {
                audio._listenInterval = setInterval(() => {
                    if (isPlaying && !audio.paused) stats.totalListenTime = (stats.totalListenTime||0) + 1;
                }, 1000);
            }
        }).catch(() => showToast('Cannot play this song.'));
    } else {
        audio.pause(); isPlaying = false; updatePlayButton();
    }
}
function nextSong() {
    if (playlist.length === 0) { showToast('⏭ No songs in queue'); return; }
    let nextIdx;
    if (isShuffled) {
        let newIdx; do { newIdx = Math.floor(Math.random() * playlist.length); } while (newIdx === currentIndex && playlist.length > 1);
        nextIdx = newIdx;
    } else {
        nextIdx = (currentIndex + 1) % playlist.length;
    }
    playSong(nextIdx);
    showToast('⏭ Next');
}
function prevSong() {
    if (playlist.length === 0) { showToast('⏮ No songs in queue'); return; }
    if (audio.currentTime > 3) { audio.currentTime = 0; showToast('⏮ Restarted'); return; }
    let prevIdx;
    if (isShuffled) {
        let newIdx; do { newIdx = Math.floor(Math.random() * playlist.length); } while (newIdx === currentIndex && playlist.length > 1);
        prevIdx = newIdx;
    } else {
        prevIdx = (currentIndex - 1 + playlist.length) % playlist.length;
    }
    playSong(prevIdx);
    showToast('⏮ Previous');
}
function updatePlayButton() {
    const icon = playBtn.querySelector('i');
    icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    miniPlay.querySelector('i').className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
}
function updatePlaylistScroll() {
    const active = queueList.querySelector('.queue-item.active');
    if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function updateAlarmSongSelect() {
    alarmSongSelect.innerHTML = '<option value="">— Current song —</option>';
    playlist.forEach((song, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${song.title} - ${song.artist}`;
        alarmSongSelect.appendChild(opt);
    });
}

// ---------- AUDIO EVENTS ----------
audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = `${Math.min(pct, 100)}%`;
        currentTimeEl.textContent = formatTime(audio.currentTime);
        totalDurationEl.textContent = formatTime(audio.duration);
        const song = playlist[currentIndex];
        if (song && !song.duration && audio.duration) { song.duration = audio.duration; renderQueue(); }
    }
});
audio.addEventListener('loadedmetadata', () => {
    if (audio.duration) {
        totalDurationEl.textContent = formatTime(audio.duration);
        const song = playlist[currentIndex];
        if (song && !song.duration) { song.duration = audio.duration; renderQueue(); }
    }
});
audio.addEventListener('play', () => waveLoading.classList.add('active'));
audio.addEventListener('pause', () => waveLoading.classList.remove('active'));
audio.addEventListener('ended', () => {
    waveLoading.classList.remove('active');
    if (repeatMode === 'one') { audio.currentTime = 0; audio.play().catch(()=>{}); return; }
    if (repeatMode === 'all' || playlist.length > 1) { nextSong(); }
    else { isPlaying = false; updatePlayButton(); progressFill.style.width = '100%'; currentTimeEl.textContent = formatTime(audio.duration||0); }
});
audio.addEventListener('error', () => { showToast('Error loading audio.'); isPlaying = false; updatePlayButton(); });

// ---------- PROGRESS SEEK ----------
progressWrapper.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progressWrapper.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
});

// ---------- VOLUME ----------
volumeSlider.addEventListener('input', () => {
    const val = parseFloat(volumeSlider.value);
    audio.volume = val;
    volLabel.textContent = `${Math.round(val*100)}%`;
    saveToLocalStorage();
});
audio.volume = 0.8; volLabel.textContent = '80%';

// ---------- SPEED ----------
document.querySelectorAll('#speedControl button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#speedControl button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        playbackSpeed = parseFloat(btn.dataset.speed);
        audio.playbackRate = playbackSpeed;
        showToast(`Speed: ${playbackSpeed}x`);
        saveToLocalStorage();
    });
});

// ---------- SHUFFLE ----------
shuffleBtn.addEventListener('click', () => {
    isShuffled = !isShuffled;
    shuffleBtn.classList.toggle('shuffle-active', isShuffled);
    showToast(isShuffled ? 'Shuffle ON' : 'Shuffle OFF');
    saveToLocalStorage();
});

// ---------- REPEAT ----------
repeatBtn.addEventListener('click', () => {
    if (repeatMode === 'none') {
        repeatMode = 'all';
        repeatBtn.classList.remove('repeat-one-active');
        repeatBtn.classList.add('repeat-active');
        showToast('Repeat: All');
    } else if (repeatMode === 'all') {
        repeatMode = 'one';
        repeatBtn.classList.remove('repeat-active');
        repeatBtn.classList.add('repeat-one-active');
        showToast('Repeat: One');
    } else {
        repeatMode = 'none';
        repeatBtn.classList.remove('repeat-active', 'repeat-one-active');
        showToast('Repeat: Off');
    }
    saveToLocalStorage();
});

// ---------- QUEUE TOGGLE ----------
queueToggle.addEventListener('click', () => {
    isQueueOpen = !isQueueOpen;
    queueToggle.classList.toggle('active', isQueueOpen);
    if (isQueueOpen) document.querySelector('.sidebar').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ---------- MINI PLAYER ----------
miniToggle.addEventListener('click', () => {
    isMiniVisible = !isMiniVisible;
    miniPlayer.classList.toggle('visible', isMiniVisible);
    showToast(isMiniVisible ? 'Mini player shown' : 'Mini player hidden');
});
miniPlay.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
miniPrev.addEventListener('click', (e) => { e.stopPropagation(); prevSong(); });
miniNext.addEventListener('click', (e) => { e.stopPropagation(); nextSong(); });
miniPlayer.addEventListener('click', () => { document.querySelector('.player-card').scrollIntoView({ behavior: 'smooth' }); });

// ---------- PICTURE-IN-PICTURE ----------
pipBtn.addEventListener('click', async () => {
    if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        showToast('Exited Picture-in-Picture');
        return;
    }
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 400; canvas.height = 400;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0,0,400,400);
        grad.addColorStop(0, '#a78bfa');
        grad.addColorStop(1, '#60a5fa');
        ctx.fillStyle = grad; ctx.fillRect(0,0,400,400);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '60px "Segoe UI", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🎵', 200, 180);
        ctx.font = '24px "Segoe UI", sans-serif';
        ctx.fillStyle = '#fff';
        const title = playlist[currentIndex]?.title || 'Music Player';
        ctx.fillText(title, 200, 280);
        const stream = canvas.captureStream();
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        await video.requestPictureInPicture();
        showToast('🎬 Picture-in-Picture active');
    } catch(e) { showToast('PiP not supported in this browser'); }
});

// ---------- THEMES ----------
themeBtn.addEventListener('click', () => {
    themePanel.style.display = themePanel.style.display === 'none' ? 'block' : 'none';
});
themeSelector.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        themeSelector.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.dataset.theme;
        document.documentElement.setAttribute('data-theme', theme);
        currentTheme = theme;
        showToast(`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
        saveToLocalStorage();
    });
});

// ---------- SLEEP TIMER ----------
sleepBtn.addEventListener('click', () => sleepModal.classList.add('active'));
document.querySelectorAll('[data-close="sleepModal"]').forEach(el => {
    el.addEventListener('click', () => sleepModal.classList.remove('active'));
});
sleepModal.addEventListener('click', (e) => { if (e.target === sleepModal) sleepModal.classList.remove('active'); });
document.querySelectorAll('.sleep-option').forEach(btn => {
    btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.minutes);
        if (minutes === 0) {
            clearTimeout(sleepTimeoutId); sleepTimerId = null;
            sleepStatus.textContent = 'Sleep timer cancelled';
            showToast('Sleep timer cancelled');
            sleepModal.classList.remove('active');
            return;
        }
        clearTimeout(sleepTimeoutId);
        const ms = minutes * 60 * 1000;
        sleepStatus.textContent = `⏰ Sleep timer set for ${minutes} minutes`;
        sleepTimeoutId = setTimeout(() => {
            audio.pause(); isPlaying = false; updatePlayButton();
            showToast(`💤 Sleep timer: stopped after ${minutes} minutes`);
            sleepStatus.textContent = `Sleep timer triggered at ${new Date().toLocaleTimeString()}`;
            sleepTimerId = null;
        }, ms);
        sleepTimerId = setTimeout(() => {}, ms);
        showToast(`Sleep timer: ${minutes} minutes`);
        sleepModal.classList.remove('active');
    });
});

// ---------- ALARM ----------
alarmBtn.addEventListener('click', () => { updateAlarmSongSelect(); alarmModal.classList.add('active'); });
document.querySelectorAll('[data-close="alarmModal"]').forEach(el => {
    el.addEventListener('click', () => alarmModal.classList.remove('active'));
});
alarmModal.addEventListener('click', (e) => { if (e.target === alarmModal) alarmModal.classList.remove('active'); });
$('alarmSetBtn').addEventListener('click', () => {
    const time = alarmTimeInput.value;
    if (!time) { showToast('Please select a time'); return; }
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const diff = target.getTime() - now.getTime();
    clearTimeout(alarmTimeoutId);
    const songIdx = parseInt(alarmSongSelect.value);
    const alarmSong = !isNaN(songIdx) && songIdx >= 0 && songIdx < playlist.length ? playlist[songIdx] : playlist[currentIndex];
    alarmTimeoutId = setTimeout(() => {
        if (alarmSong) {
            playSong(playlist.indexOf(alarmSong));
            showToast(`⏰ Alarm! Playing ${alarmSong.title}`);
            alarmStatus.textContent = `Alarm triggered at ${new Date().toLocaleTimeString()}`;
        } else {
            showToast('⏰ Alarm! No song available');
        }
        alarmTimeoutId = null;
    }, diff);
    alarmTime = target;
    alarmStatus.textContent = `⏰ Alarm set for ${target.toLocaleTimeString()} (${Math.round(diff / 60000)} min)`;
    showToast(`Alarm set for ${target.toLocaleTimeString()}`);
    alarmModal.classList.remove('active');
});
$('alarmCancelBtn').addEventListener('click', () => {
    clearTimeout(alarmTimeoutId); alarmTimeoutId = null; alarmTime = null;
    alarmStatus.textContent = 'Alarm cancelled';
    showToast('Alarm cancelled');
    alarmModal.classList.remove('active');
});

// ---------- EXPORT / IMPORT ----------
exportBtn.addEventListener('click', exportPlaylist);
importBtn.addEventListener('click', () => importInput.click());
importInput.addEventListener('change', (e) => {
    if (e.target.files.length) { importPlaylist(e.target.files[0]); importInput.value = ''; }
});
clearQueueBtn.addEventListener('click', clearQueue);
syncBtn.addEventListener('click', syncWithFirebase);

// ---------- ADD SONGS ----------
addSongsBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files.length) return;
    let added = 0;
    for (const file of files) {
        if (file.type.startsWith('audio/')) {
            const url = URL.createObjectURL(file);
            const name = file.name.replace(/\.[^.]+$/, '');
            playlist.push({
                id: getRandomId(),
                title: name,
                artist: 'Local File',
                genre: 'Other',
                url: url,
                duration: 0,
                _blobUrl: url
            });
            added++;
        }
    }
    if (added === 0) { showToast('No audio files selected'); return; }
    if (playlist.length === added) { currentIndex = 0; loadSong(0); }
    else { renderQueue(); if (!audio.src) { currentIndex = 0; loadSong(0); } }
    showToast(`Added ${added} song${added>1?'s':''}`);
    fileInput.value = '';
    saveToLocalStorage(); saveToIndexedDB();
});

// ---------- KEYBOARD SHORTCUTS ----------
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (document.querySelector('.modal-overlay.active')) return;
    switch (e.code) {
        case 'Space': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': e.preventDefault(); nextSong(); break;
        case 'ArrowLeft': e.preventDefault(); prevSong(); break;
        case 'KeyR': repeatBtn.click(); break;
        case 'KeyS': shuffleBtn.click(); break;
        case 'KeyQ': queueToggle.click(); break;
        case 'KeyM': miniToggle.click(); break;
        case 'KeyT': themeBtn.click(); break;
        case 'KeyF': crossfadeEnabled = !crossfadeEnabled; crossfadeIndicator.classList.toggle('active', crossfadeEnabled); showToast(crossfadeEnabled ? 'Crossfade ON' : 'Crossfade OFF'); saveToLocalStorage(); break;
        case 'KeyL': sleepBtn.click(); break;
        case 'KeyA': alarmBtn.click(); break;
        case 'KeyP': pipBtn.click(); break;
    }
});

// ---------- CROSSFADE DOUBLE-CLICK ----------
progressWrapper.addEventListener('dblclick', () => {
    crossfadeEnabled = !crossfadeEnabled;
    crossfadeIndicator.classList.toggle('active', crossfadeEnabled);
    showToast(crossfadeEnabled ? 'Crossfade ON' : 'Crossfade OFF');
    saveToLocalStorage();
});

// ---------- FLOATING NOTES ----------
function createMusicNotes() {
    const container = $('musicNotes');
    const notes = ['♩','♪','♫','♬','🎵','🎶'];
    for (let i=0; i<18; i++) {
        const note = document.createElement('div');
        note.className = 'music-note';
        note.textContent = notes[i % notes.length];
        note.style.left = `${Math.random()*100}%`;
        note.style.fontSize = `${12 + Math.random()*24}px`;
        note.style.animationDuration = `${12 + Math.random()*18}s`;
        note.style.animationDelay = `${Math.random()*20}s`;
        note.style.opacity = 0.03 + Math.random()*0.06;
        container.appendChild(note);
    }
}
createMusicNotes();

// ---------- RIPPLE ----------
document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .queue-item, .stat-card');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size/2}px`;
    ripple.style.top = `${e.clientY - rect.top - size/2}px`;
    target.style.position = 'relative';
    target.style.overflow = 'hidden';
    target.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
});

// ---------- INIT ----------
async function init() {
    const saved = loadFromLocalStorage();
    if (saved && saved.playlist && saved.playlist.length > 0) {
        playlist = saved.playlist.map(s => ({ ...s, _blobUrl: undefined }));
        currentIndex = saved.currentIndex || 0;
        isShuffled = saved.isShuffled || false;
        repeatMode = saved.repeatMode || 'none';
        playbackSpeed = saved.playbackSpeed || 1.0;
        stats = saved.stats || stats;
        currentTheme = saved.currentTheme || 'dark';
        crossfadeEnabled = saved.crossfadeEnabled || false;
        if (saved.volume !== undefined) { audio.volume = saved.volume; volumeSlider.value = saved.volume; volLabel.textContent = `${Math.round(saved.volume*100)}%`; }
        document.documentElement.setAttribute('data-theme', currentTheme);
        themeSelector.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === currentTheme));
        shuffleBtn.classList.toggle('shuffle-active', isShuffled);
        if (repeatMode === 'all') { repeatBtn.classList.add('repeat-active'); repeatBtn.classList.remove('repeat-one-active'); }
        else if (repeatMode === 'one') { repeatBtn.classList.add('repeat-one-active'); repeatBtn.classList.remove('repeat-active'); }
        else { repeatBtn.classList.remove('repeat-active', 'repeat-one-active'); }
        document.querySelectorAll('#speedControl button').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.speed) === playbackSpeed));
        audio.playbackRate = playbackSpeed;
        crossfadeIndicator.classList.toggle('active', crossfadeEnabled);
        if (currentIndex < playlist.length) loadSong(currentIndex);
        else { currentIndex = 0; loadSong(0); }
        renderQueue(); renderStats(); updateAlarmSongSelect();
        showToast('🎵 Welcome back!', 1500);
        saveToLocalStorage();
        return;
    }

    const dbData = await loadFromIndexedDB();
    if (dbData && dbData.songs && dbData.songs.length > 0) {
        playlist = dbData.songs.map(s => ({ ...s, _blobUrl: undefined }));
        if (dbData.stats) stats = dbData.stats;
        if (dbData.meta) {
            currentIndex = dbData.meta.currentIndex || 0;
            isShuffled = dbData.meta.isShuffled || false;
            repeatMode = dbData.meta.repeatMode || 'none';
            playbackSpeed = dbData.meta.playbackSpeed || 1.0;
            currentTheme = dbData.meta.currentTheme || 'dark';
            crossfadeEnabled = dbData.meta.crossfadeEnabled || false;
        }
        document.documentElement.setAttribute('data-theme', currentTheme);
        themeSelector.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === currentTheme));
        shuffleBtn.classList.toggle('shuffle-active', isShuffled);
        if (repeatMode === 'all') { repeatBtn.classList.add('repeat-active'); repeatBtn.classList.remove('repeat-one-active'); }
        else if (repeatMode === 'one') { repeatBtn.classList.add('repeat-one-active'); repeatBtn.classList.remove('repeat-active'); }
        else { repeatBtn.classList.remove('repeat-active', 'repeat-one-active'); }
        document.querySelectorAll('#speedControl button').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.speed) === playbackSpeed));
        audio.playbackRate = playbackSpeed;
        crossfadeIndicator.classList.toggle('active', crossfadeEnabled);
        if (currentIndex < playlist.length) loadSong(currentIndex);
        else { currentIndex = 0; loadSong(0); }
        renderQueue(); renderStats(); updateAlarmSongSelect();
        showToast('📀 Loaded from IndexedDB', 1500);
        saveToLocalStorage();
        return;
    }

    // Default songs
    playlist = DEFAULT_SONGS.map(s => ({ ...s, id: s.id }));
    currentIndex = 0;
    loadSong(0);
    renderQueue(); renderStats(); updateAlarmSongSelect();
    showToast('🎵 Ready! Add your own songs with +', 2000);
    saveToLocalStorage(); saveToIndexedDB();
}

init();

// Periodic save
setInterval(() => {
    if (playlist.length > 0) { saveToLocalStorage(); saveToIndexedDB(); }
}, 30000);

// Cleanup
window.addEventListener('beforeunload', () => {
    playlist.forEach(song => { if (song._blobUrl) URL.revokeObjectURL(song._blobUrl); });
    if (audio._listenInterval) clearInterval(audio._listenInterval);
    clearTimeout(sleepTimeoutId); clearTimeout(alarmTimeoutId);
});

console.log('🎵 Premium Music Player loaded!');
console.log('📖 Keyboard shortcuts: Space (play/pause), ←/→ (prev/next), R (repeat), S (shuffle), Q (queue), M (mini), T (themes), F (crossfade), L (sleep), A (alarm), P (PiP)');