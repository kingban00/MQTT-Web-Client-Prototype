
// --- ESTADO DA APLICAÇÃO ---
let client = null;
let isConnected = false;

// Elementos UI
const loginLayer = document.getElementById('login-layer');
const appLayer = document.getElementById('app-layer');
const loginError = document.getElementById('login-error');
const btnLogin = document.getElementById('btn-login');
const btnLoginText = document.getElementById('btn-login-text');
const btnLoading = document.getElementById('btn-login-loading');
const messagesContainer = document.getElementById('messages-container');
const subsList = document.getElementById('subs-list');
const userDisplay = document.getElementById('user-display');

// --- LÓGICA DE LOGIN ---

function attemptLogin() {
    // UI Loading
    setLoading(true);
    loginError.classList.add('hidden');

    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    const host = document.getElementById('login-host').value;
    const port = Number(document.getElementById('login-port').value);

    if (!user || !pass) {
        showError("Por favor, preencha usuário e senha.");
        setLoading(false);
        return;
    }

    // ID do cliente
    const clientId = "web-client-" + parseInt(Math.random() * 10000);

    // Instancia Cliente Paho
    // Nota: Paho usa WebSocket por baixo dos panos
    client = new Paho.MQTT.Client(host, port, clientId);

    // Callbacks
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    // Opções
    const options = {
        timeout: 5, // segundos
        userName: user,
        password: pass,
        useSSL: true, // TLS Obrigatório no nosso setup
        onSuccess: () => {
            onConnectSuccess(user);
        },
        onFailure: (errMsg) => {
            setLoading(false);
            console.error(errMsg);
            let niceError = "Não foi possível conectar.";
            if (errMsg.errorCode === 7) niceError = "Erro de Socket (SSL). Verifique se você aceitou o certificado em https://localhost:9001 e tente novamente.";
            else if (errMsg.errorCode === 8) niceError = "Usuário ou senha incorretos.";
            else if (errMsg.errorMessage) niceError = errMsg.errorMessage;

            showError(niceError);
        }
    };

    console.log(`Conectando a wss://${host}:${port} como ${user}...`);

    try {
        client.connect(options);
    } catch (e) {
        setLoading(false);
        showError("Erro inesperado: " + e);
    }
}

function onConnectSuccess(username) {
    setLoading(false);
    isConnected = true;

    // Troca de Telas
    loginLayer.classList.add('hidden-layer');
    appLayer.classList.remove('hidden-layer');

    // Setup App Info
    userDisplay.innerText = username;
    logSystem("Sistema conectado ao Broker com sucesso.");
}

function logout() {
    if (client) {
        try { client.disconnect(); } catch (e) { }
    }
    isConnected = false;
    client = null;

    // Reset UI
    appLayer.classList.add('hidden-layer');
    loginLayer.classList.remove('hidden-layer');
    document.getElementById('login-password').value = '';
    loginError.classList.add('hidden');
}

function setLoading(isLoading) {
    if (isLoading) {
        btnLogin.disabled = true;
        btnLogin.classList.add('opacity-75', 'cursor-not-allowed');
        btnLoginText.innerText = "Conectando...";
        btnLoading.classList.remove('hidden');
    } else {
        btnLogin.disabled = false;
        btnLogin.classList.remove('opacity-75', 'cursor-not-allowed');
        btnLoginText.innerText = "Entrar no Sistema";
        btnLoading.classList.add('hidden');
    }
}

function showError(msg) {
    loginError.innerText = msg;
    loginError.classList.remove('hidden');
}

// --- LÓGICA DO APP (MQTT) ---

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log("Conexão perdida:" + responseObject.errorMessage);
        // Se cair a conexão, voltamos pro login com erro? 
        // Ou apenas mostramos alert? Vamos voltar pro login por segurança.
        alert("Conexão perdida com o servidor: " + responseObject.errorMessage);
        logout();
    }
}

function onMessageArrived(message) {
    logMessage(message.destinationName, message.payloadString, false);
}

function publishMessage() {
    if (!isConnected) return;

    const topic = document.getElementById('pub-topic').value;
    const payload = document.getElementById('pub-payload').value;

    if (!topic || !payload) {
        alert("Preencha tópico e mensagem");
        return;
    }

    const message = new Paho.MQTT.Message(payload);
    message.destinationName = topic;
    try {
        client.send(message);
        logMessage(topic, payload, true);
    } catch (e) {
        alert("Erro ao enviar: " + e);
    }
}

function subscribeTopic() {
    if (!isConnected) return;
    const topicInput = document.getElementById('sub-topic');
    const topic = topicInput.value;

    if (!topic) return;

    client.subscribe(topic);
    logSystem("Inscrito no tópico: " + topic);

    // Adicionar Badge
    if (subsList.querySelector('span.italic')) subsList.innerHTML = '';

    const badge = document.createElement('div');
    badge.className = "bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs border border-purple-200 flex items-center gap-1 font-mono";
    badge.innerHTML = `<span>${topic}</span>`;
    subsList.appendChild(badge);

    topicInput.value = '';
}

// --- SISTEMA DE LOG VISUAL ---

function logMessage(topic, payload, isSent) {
    const div = document.createElement('div');
    const time = new Date().toLocaleTimeString();
    const directionIcon = isSent ? '⬆️ Enviado' : '⬇️ Recebido';
    const bgClass = isSent ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200';
    const textClass = isSent ? 'text-green-700' : 'text-blue-700';

    div.className = `message-enter p-3 rounded-lg border ${bgClass} shadow-sm`;
    div.innerHTML = `
        <div class="flex justify-between items-center text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-bold">
            <span>${directionIcon}</span>
            <span>${time}</span>
        </div>
        <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 font-mono bg-white/50 px-1 rounded w-fit">${topic}</span>
            <div class="${textClass} font-mono text-sm break-all font-semibold">${payload}</div>
        </div>
    `;

    // Remove placeholder se existir
    const placeholder = messagesContainer.querySelector('.text-center');
    if (placeholder && placeholder.innerText.includes('pronto')) placeholder.remove();

    messagesContainer.prepend(div);
}

function logSystem(msg) {
    const div = document.createElement('div');
    div.className = "text-center my-2 text-xs text-slate-400 italic flex items-center justify-center gap-2 before:h-[1px] before:w-4 before:bg-slate-300 after:h-[1px] after:w-4 after:bg-slate-300";
    div.innerText = msg;

    // Remove placeholder se existir
    const placeholder = messagesContainer.querySelector('.text-center');
    if (placeholder && placeholder.innerText.includes('pronto')) placeholder.remove();

    messagesContainer.prepend(div);
}

function clearConsole() {
    messagesContainer.innerHTML = `
        <div class="text-center mt-20">
            <p class="text-slate-400 italic">Histórico limpo.</p>
        </div>
    `;
}
