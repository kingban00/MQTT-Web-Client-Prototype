# MQTT-Web-Client-Prototype
Um protótipo de cliente web para comunicação em tempo real utilizando o protocolo MQTT via WebSockets.

# 📡 MQTT Web Client Prototype

Um protótipo de cliente web para comunicação em tempo real utilizando o protocolo MQTT via WebSockets.

## 📋 Sobre o Projeto

Este projeto foi desenvolvido como parte de um estudo prático sobre **IoT e Protocolos de Comunicação**. O objetivo principal foi criar uma interface web capaz de se conectar a um Broker MQTT local via WebSockets para publicar e assinar tópicos em tempo real.

O sistema demonstra o fluxo completo de mensagens:
1.  **Configuração** de um Broker Mosquitto com suporte a WebSockets.
2.  **Conexão** de um cliente Web utilizando Paho MQTT Client.
3.  **Troca de mensagens** (Pub/Sub) assíncrona.



## 🚀 Funcionalidades

- [x] Conexão dinâmica com Broker MQTT (Host/Porta).
- [x] Indicador visual de status de conexão.
- [x] Assinatura (Subscribe) em múltiplos tópicos.
- [x] Publicação (Publish) de mensagens de texto.
- [x] Log de mensagens recebidas em tempo real com timestamp.

## 🛠️ Tecnologias Utilizadas

* **HTML5 & CSS3**: Interface do usuário (responsiva e moderna).
* **JavaScript (ES6+)**: Lógica de conexão e manipulação do DOM.
* **Eclipse Paho JavaScript Client**: Biblioteca para comunicação MQTT via WebSockets.
* **Mosquitto MQTT**: Broker de mensagens (Backend).

## 📦 Como Executar

### Pré-requisitos
* Um Broker MQTT rodando localmente (ex: Mosquitto) configurado para aceitar WebSockets.
* Um navegador web moderno.

### Passo 1: Configurar o Broker
Se você estiver usando o Mosquitto localmente, é necessário habilitar a porta de WebSockets (geralmente `9001`). Utilize o arquivo de configuração disponível em `config/mosquitto.conf` deste repositório.

**Comando exemplo** (se tiver o Mosquitto instalado):
```bash
mosquitto -c config/mosquitto.conf -v
```

## 🚀 Passo 2: Rodar a Aplicação

Siga as instruções abaixo para executar o projeto localmente:

1. **Clone** este repositório:
   ```bash
   git clone [https://github.com/kingban00/MQTT-Web-Client-Prototype.git]
   ```

   ### 🚀 Como Executar

2. **Navegue** até a pasta `public`.
3. **Abra** o arquivo `index.html` diretamente no seu navegador.
4. **Preencha** os dados de conexão (ex: `localhost` e porta `9001`) e clique em **Conectar**.

---

### 📸 Screenshots

![Demonstração do Sistema](link-da-imagem-ou-gif.gif)

---

### 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo `LICENSE` para mais detalhes.

---

### 👨‍💻 Desenvolvido por:
**Kingban00**
