const peer = new Peer({
    host: '://herokuapp.com',
    port: 443,
    secure: true,
    path: '/'
});


let localStream;
let currentCall;

const myIdEl = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id');
const callBtn = document.getElementById('call-btn');
const hangupBtn = document.getElementById('hangup-btn');
const statusEl = document.getElementById('call-status');

peer.on('open', (id) => { 
    myIdEl.innerText = id; 
});

peer.on('error', (err) => {
    console.error(err);
    myIdEl.innerText = 'Ошибка сети';
});

async function getMedia() {
    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    return localStream;
}

callBtn.addEventListener('click', async () => {
    const remoteId = peerIdInput.value.trim();
    if (!remoteId) return alert('Введите ID собеседника');
    statusEl.innerText = 'Вызов...';
    try {
        const stream = await getMedia();
        currentCall = peer.call(remoteId, stream);
        setupCallListeners(currentCall);
    } catch (err) {
        statusEl.innerText = 'Ошибка: нужен микрофон';
    }
});

peer.on('call', async (call) => {
    if (confirm(`Входящий звонок от ${call.peer}. Ответить?`)) {
        try {
            const stream = await getMedia();
            call.answer(stream);
            currentCall = call;
            setupCallListeners(currentCall);
        } catch (err) {
            console.error(err);
        }
    } else {
        call.close();
    }
});

function setupCallListeners(call) {
    callBtn.style.display = 'none';
    hangupBtn.style.display = 'block';
    statusEl.innerText = 'Разговор...';

    call.on('stream', (remoteStream) => {
        let audio = document.getElementById('remoteAudio');
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = 'remoteAudio';
            document.body.appendChild(audio);
        }
        audio.srcObject = remoteStream;
        audio.play();
    });

    call.on('close', () => { endCall(); });
}

hangupBtn.addEventListener('click', () => {
    if (currentCall) currentCall.close();
    endCall();
});

function endCall() {
    callBtn.style.display = 'block';
    hangupBtn.style.display = 'none';
    statusEl.innerText = 'Звонок завершен';
    const audio = document.getElementById('remoteAudio');
    if (audio) audio.srcObject = null;
}
