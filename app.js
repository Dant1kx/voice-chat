// Подключаемся к независимому публичному сигнальному серверу
const socket = io('https://glitch.me');

let localStream = null;
let peerConnection = null;
let myId = null;

const myIdEl = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id');
const callBtn = document.getElementById('call-btn');
const hangupBtn = document.getElementById('hangup-btn');
const statusEl = document.getElementById('call-status');

// Настройка STUN-сервера Google (он разрешен в РФ и нужен для обмена IP)
const rtcConfig = {
    iceServers: [{ urls: 'stun:://google.com' }]
};

// 1. Получаем ID от сервера при подключении
socket.on('connect', () => {
    myId = socket.id.substring(0, 6); // Делаем ID коротким (6 символов) для удобства
    myIdEl.innerText = myId;
    statusEl.innerText = 'Готов к звонку';
    socket.emit('register-id', myId);
});

socket.on('connect_error', () => {
    myIdEl.innerText = 'Сбой сети';
    statusEl.innerText = 'Ошибка подключения к шлюзу.';
});

async function startLocalStream() {
    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    return localStream;
}

// 2. Инициация звонка (Кнопка Позвонить)
callBtn.addEventListener('click', async () => {
    const targetId = peerIdInput.value.trim();
    if (!targetId) return alert('Введите ID собеседника');
    
    statusEl.innerText = 'Вызываю...';
    await startLocalStream();
    
    createPeerConnection(targetId);
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.emit('video-offer', { targetId, offer });
});

// 3. Обработка входящего звонка и сигналов WebRTC
socket.on('video-offer', async (data) => {
    if (confirm('Входящий голосовой звонок! Ответить?')) {
        await startLocalStream();
        createPeerConnection(data.senderId);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('video-answer', { targetId: data.senderId, answer });
        
        callBtn.style.display = 'none';
        hangupBtn.style.display = 'block';
        statusEl.innerText = 'Разговор...';
    }
});

socket.on('video-answer', async (data) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    callBtn.style.display = 'none';
    hangupBtn.style.display = 'block';
    statusEl.innerText = 'Разговор...';
});

socket.on('new-ice-candidate', async (data) => {
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) { console.error(e); }
    }
});

// Создание P2P моста
function createPeerConnection(targetId) {
    peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Добавляем наш микрофон в канал связи
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    // Отправляем сетевые координаты собеседнику
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('new-ice-candidate', { targetId, candidate: event.candidate });
        }
    };
    
    // Ловим аудиопоток от собеседника
    peerConnection.ontrack = (event) => {
        let audio = document.getElementById('remoteAudio');
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = 'remoteAudio';
            document.body.appendChild(audio);
        }
        audio.srcObject = event.streams[0];
        audio.play().catch(e => console.error(e));
    };
}

// Кнопка Положить трубку
hangupBtn.addEventListener('click', () => {
    socket.emit('hangup', { targetId: peerIdInput.value.trim() });
    endCall();
});

socket.on('hangup', () => { endCall(); });

function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    callBtn.style.display = 'block';
    hangupBtn.style.display = 'none';
    statusEl.innerText = 'Звонок завершен';
    const audio = document.getElementById('remoteAudio');
    if (audio) audio.srcObject = null;
}

