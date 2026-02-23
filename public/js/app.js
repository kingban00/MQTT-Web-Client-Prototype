
// --- ESTADO DA APLICAÇÃO ---
let client = null;
let isConnected = false;
let pendingMessages = []; // Restaurado: Lista de pendências

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
const topicInput = document.getElementById('pub-topic');
const payloadInput = document.getElementById('pub-payload');

// --- LÓGICA DE LOGIN ---

function attemptLogin() {
    // UI Loading
    setLoading(true);
    loginError.classList.add('hidden');

    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    const host = document.getElementById('login-host').value;
    const port = Number(document.getElementById('login-port').value);

    // ID do cliente
    const clientId = "web-client-" + parseInt(Math.random() * 10000);

    if (!user || !pass) {
        showError("Por favor, preencha usuário e senha.");
        setLoading(false);
        return;
    }


    /* --- CLIENT ACESS CONTROL (Para Feedback Visual) --- */
    // Essa lógica local deve espelhar o Regras.ACL do broker

    // --- CONNECT ---

    // Instancia Cliente Paho de forma segura
    try {
        if (typeof Paho === 'undefined') {
            throw new Error("Paho Global Object is undefined. Check Library Import.");
        }

        if (typeof Paho.Client === 'function') {
            // Versão 1.1+ (Namespace Simplificado)
            client = new Paho.Client(host, port, clientId);
        } else if (typeof Paho.MQTT !== 'undefined' && typeof Paho.MQTT.Client === 'function') {
            // Versão 1.0.x (Namespace Legacy)
            client = new Paho.MQTT.Client(host, port, clientId);
        } else {
            // Tenta achar em window global
            throw new Error("Namespace Paho.Client ou Paho.MQTT.Client não encontrado.");
        }
    } catch (e) {
        console.error("Falha ao criar cliente MQTT:", e);
        showError("Erro fatal: Biblioteca MQTT não carregada corretamente (" + e.message + ")");
        setLoading(false);
        return;
    }

    // Callbacks
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;
    client.onMessageDelivered = onMessageDelivered;

    // --- LWT (LAST WILL) CONFIGURATION ---
    // Opcional: Define mensagem a ser enviada se desconectar inesperadamente.
    // TÓPICO DEVE SER PERMITIDO NO ACL!
    let lwtTopic = `telemetria/${user}/status`;

    if (user === 'admin') lwtTopic = `status/${user}`;
    else if (user === 'web_client') lwtTopic = `comandos/monitoramento/web/${clientId}`;
    else if (user.startsWith('sensor_')) lwtTopic = `telemetria/${user}/status`;

    const lwtPayload = JSON.stringify({ status: 'offline', timestamp: Date.now() });

    // Criação da Mensagem LWT (segura)
    let willMessage;
    if (typeof Paho.Message === 'function') willMessage = new Paho.Message(lwtPayload);
    else willMessage = new Paho.MQTT.Message(lwtPayload);

    willMessage.destinationName = lwtTopic;
    willMessage.qos = 1;
    willMessage.retained = true; // Retained para que saibam o último estado conhecido

    console.log(`Configurando LWT em: ${lwtTopic}`);

    // Opções de Conexão
    const options = {
        mqttVersion: 4, // MQTT 3.1.1
        timeout: 5, // segundos
        userName: user,
        password: pass,
        useSSL: true, // TLS
        willMessage: willMessage, // Adiciona o LWT
        onSuccess: () => {
            // Ao conectar, publicamos "Online" no mesmo tópico
            publishOnlineStatus(lwtTopic);
            onConnectSuccess(user);
        },
        onFailure: (errMsg) => {
            setLoading(false);
            console.error(errMsg);
            let niceError = "Não foi possível conectar.";
            if (errMsg.errorCode === 8) niceError = "Acesso Negado (Usuário/Senha ou Tópico LWT Proibido).";
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

function publishOnlineStatus(topic) {
    // Publica "Online" (Retained) para sobrescrever o LWT offline antigo se houver
    const payload = JSON.stringify({ status: 'online', timestamp: Date.now() });
    let message;
    if (typeof Paho.Message === 'function') message = new Paho.Message(payload);
    else message = new Paho.MQTT.Message(payload);

    message.destinationName = topic;
    message.qos = 1;
    message.retained = true;

    try {
        client.send(message);
        console.log("Status ONLINE publicado em:", topic);
    } catch (e) {
        console.warn("Falha ao publicar status online:", e);
    }
}


function onConnectSuccess(username) {
    setLoading(false);
    isConnected = true;
    pendingMessages = [];

    // Troca de Telas
    loginLayer.classList.add('hidden-layer');
    appLayer.classList.remove('hidden-layer');

    // Setup App Info
    userDisplay.innerText = username;
    logSystem("Sistema conectado ao Broker com sucesso.");

    // --- SUBSCRIÇÃO AUTOMÁTICA (AUTO-SUB) ---
    // Faz o frontend se comportar de forma inteligente, assinando tópicos relevantes.

    if (username === 'admin' || username === 'web_client') {
        // Modo "MQTT Explorer": Assina tudo para monitoramento
        console.log("Auto-subscribing to # (Admin View)");
        client.subscribe('#');
        addBadgeToUI('#');
    } else {
        // Modo Sensor/Usuário Comum: Assina apenas seus comandos
        const commandTopic = `comandos/${username}/#`;
        console.log(`Auto-subscribing to ${commandTopic}`);
        client.subscribe(commandTopic);
        addBadgeToUI(commandTopic);
    }
}

// Helper para adicionar badge visual sem precisar do input
function addBadgeToUI(topic) {
    if (subsList.querySelector('span.italic')) subsList.innerHTML = '';

    // Evita duplicatas visuais
    const existing = Array.from(subsList.children).find(el => el.textContent === topic);
    if (existing) return;

    const badge = document.createElement('div');
    badge.className = "bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs border border-purple-200 flex items-center gap-1 font-mono";
    badge.innerHTML = `<span>${topic}</span>`;
    subsList.appendChild(badge);
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
    const errorEl = document.getElementById('pub-error-toast');
    if (errorEl) errorEl.remove();
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
    isConnected = false;

    // Debug Visual
    logSystem(`[DEBUG] ConnectionLost: ${responseObject.errorCode}`);

    if (responseObject.errorCode !== 0) {
        const disconnectReason = "Conexão encerrada (Provável Permissão Negada ou Timeout)";

        // Marca todas as pendentes como erro imediatamente
        if (pendingMessages.length > 0) {
            pendingMessages.forEach(msgEl => {
                markAsError(msgEl, disconnectReason);
            });
            pendingMessages = [];
        }

        alert("Conexão perdida com o servidor. (Código: " + responseObject.errorCode + ")");
        logout();
    }
}

function onMessageArrived(message) {
    logMessage(message.destinationName, message.payloadString, 'received');
}

function onMessageDelivered(message) {
    // PUBACK recebido do Broker
    console.log("PUBACK Recebido:", message.destinationName);

    // Se chegou aqui, passou no Client ACL e no Broker ACL (ou broker silencioso)
    if (pendingMessages.length > 0) {
        const msgEl = pendingMessages.shift();
        markAsSuccess(msgEl);
    }
}

// --- VALIDAÇÃO DE PERMISSÕES (CLIENT-SIDE ACL) ---
function checkPermission(username, topic) {
    // 1. Admin tem acesso total
    if (username === 'admin') return { allowed: true };

    // 2. Web Client (Dashboard)
    if (username === 'web_client') {
        if (topic.startsWith('comandos')) return { allowed: true };
        return { allowed: false, reason: "Web Client só pode publicar em 'comandos/...'." };
    }

    // 3. Sensores (sensor_01, etc)
    // O usuário só pode escrever em telemetria/{SEU_NOME}/...
    const sensorTopic = `telemetria/${username}`;

    // Verifica se o tópico começa exatamente com a permissão do usuário
    // Adicionei validação para evitar enviar em 'telemetria/sensor_01_fake'
    if (topic.startsWith(sensorTopic)) {
        return { allowed: true };
    }

    return { allowed: false, reason: `Negado: ${username} só escreve em '${sensorTopic}...'` };
}

function publishMessage() {
    if (!isConnected) return;

    const topic = document.getElementById('pub-topic').value.trim();
    const payload = document.getElementById('pub-payload').value.trim();
    const currentUser = document.getElementById('user-display').innerText;

    if (!topic || !payload) {
        alert("Preencha tópico e mensagem");
        return;
    }

    // --- 1. VALIDAÇÃO LOCAL ---
    const permission = checkPermission(currentUser, topic);

    if (!permission.allowed) {
        // Bloqueia IMEDIATAMENTE e mostra erro visual
        const msgEl = logMessage(topic, payload, 'pending');

        // Simula rejeição rápida
        setTimeout(() => {
            markAsError(msgEl, permission.reason);
        }, 200);

        return; // NÃO ENVIA PARA O BROKER
    }

    // --- 2. ENVIO PARA O BROKER ---
    // Criação segura de mensagem (v1.1 vs v1.0)
    let message;
    if (typeof Paho.Message === 'function') {
        message = new Paho.Message(payload);
    } else if (typeof Paho.MQTT !== 'undefined' && typeof Paho.MQTT.Message === 'function') {
        message = new Paho.MQTT.Message(payload);
    } else {
        alert("Erro fatal: Message constructor not found.");
        return;
    }

    message.destinationName = topic;
    message.qos = 1;

    try {
        client.send(message);

        const msgEl = logMessage(topic, payload, 'pending');
        pendingMessages.push(msgEl); // Adiciona na fila de espera por PUBACK

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

    if (subsList.querySelector('span.italic')) subsList.innerHTML = '';

    const badge = document.createElement('div');
    badge.className = "bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs border border-purple-200 flex items-center gap-1 font-mono";
    badge.innerHTML = `<span>${topic}</span>`;
    subsList.appendChild(badge);

    topicInput.value = '';
}

// --- SISTEMA DE LOG VISUAL ---

function logMessage(topic, payload, type) {
    const div = document.createElement('div');
    const time = new Date().toLocaleTimeString();

    let directionIcon = '';
    let bgClass = '';
    let textClass = '';
    let statusBadge = '';

    if (type === 'received') {
        directionIcon = '⬇️ Recebido';
        bgClass = 'bg-blue-50 border-blue-200';
        textClass = 'text-blue-700';
    } else if (type === 'pending') {
        directionIcon = '⬆️ Enviando...';
        bgClass = 'bg-yellow-50 border-yellow-200 opacity-80';
        textClass = 'text-slate-600';
        statusBadge = '<span class="status-badge ml-2 text-[10px] bg-yellow-200 text-yellow-800 px-1 rounded animate-pulse">⏳ Pendente</span>';
    } else if (type === 'sent') { // Caso usemos diretamente
        directionIcon = '⬆️ Enviado';
        bgClass = 'bg-green-50 border-green-200';
        textClass = 'text-green-700';
    }

    div.className = `message-item p-3 rounded-lg border ${bgClass} shadow-sm transition-all duration-300`;
    div.innerHTML = `
        <div class="flex justify-between items-center text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-bold">
            <span class="flex items-center gap-1">
                <span class="direction-text">${directionIcon}</span> 
                ${statusBadge}
            </span>
            <span>${time}</span>
        </div>
        <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 font-mono bg-white/50 px-1 rounded w-fit">${topic}</span>
            <div class="payload-content ${textClass} font-mono text-sm break-all font-semibold">${payload}</div>
        </div>
    `;

    const placeholder = messagesContainer.querySelector('.text-center');
    if (placeholder && placeholder.innerText.includes('pronto')) placeholder.remove();

    messagesContainer.prepend(div);
    return div;
}

function markAsSuccess(div) {
    if (!div) return;

    div.classList.remove('bg-yellow-50', 'border-yellow-200', 'opacity-80', 'bg-red-50', 'border-red-200');
    div.classList.add('bg-green-50', 'border-green-200');

    const dirText = div.querySelector('.direction-text');
    if (dirText) dirText.innerText = '⬆️ Enviado';

    const payloadText = div.querySelector('.payload-content');
    if (payloadText) {
        payloadText.className = 'payload-content text-green-700 font-mono text-sm break-all font-semibold';
    }

    const badge = div.querySelector('.status-badge');
    if (badge) badge.remove();
}

function markAsError(div, reason) {
    if (!div) return;

    div.classList.remove('bg-yellow-50', 'border-yellow-200', 'opacity-80', 'bg-green-50', 'border-green-200');
    div.classList.add('bg-red-50', 'border-red-200');

    const dirText = div.querySelector('.direction-text');
    if (dirText) dirText.innerText = '❌ Bloqueado';

    const payloadText = div.querySelector('.payload-content');
    if (payloadText) {
        payloadText.className = 'payload-content text-red-700 font-mono text-sm break-all font-semibold';
    }

    let badge = div.querySelector('.status-badge');
    if (!badge) {
        const header = div.querySelector('.flex.items-center.gap-1');
        badge = document.createElement('span');
        header.appendChild(badge);
    }
    badge.className = "status-badge ml-2 text-[10px] bg-red-200 text-red-800 px-1 rounded font-bold";
    badge.innerText = "REGRA VIOLADA";

    const container = div.querySelector('.flex.flex-col');
    // Evita duplicar msg de erro
    if (!container.querySelector('.error-reason')) {
        const err = document.createElement('div');
        err.className = "error-reason error-msg text-[10px] text-red-500 font-bold mt-1 bg-red-100 p-1 rounded border border-red-200";
        err.innerText = reason;
        container.appendChild(err);
    }
}

function logSystem(msg) {
    const div = document.createElement('div');
    div.className = "text-center my-2 text-xs text-slate-400 italic flex items-center justify-center gap-2 before:h-[1px] before:w-4 before:bg-slate-300 after:h-[1px] after:w-4 after:bg-slate-300";
    div.innerText = msg;
    messagesContainer.prepend(div);
}

function clearConsole() {
    messagesContainer.innerHTML = `
        <div class="text-center mt-20">
            <p class="text-slate-400 italic">Histórico limpo.</p>
        </div>
    `;
}
