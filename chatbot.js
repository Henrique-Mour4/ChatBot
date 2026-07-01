const qrcode = require('qrcode-terminal');
const { Client, Buttons, List, MessageMedia } = require('whatsapp-web.js');

// Inicializa o cliente WhatsApp
const client = new Client();

// Objeto para armazenar o estado da conversa, idioma, opção de processo migratório e timestamp
const userState = {};

// Gera o QR code para autenticação
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Confirmação de conexão bem-sucedida
client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
});

// Inicializa o cliente
client.initialize();

// Função de atraso para simular digitação
const delay = ms => new Promise(res => setTimeout(res, ms));

// Captura mensagens enviadas pelo bot (incluindo mensagens manuais)
client.on('message_create', async msg => {
    // Verifica se a mensagem foi enviada pelo bot e não é para um grupo
    if (msg.fromMe && !msg.to.endsWith('@g.us')) {
        // Define um período de espera de 6 horas (21600000 ms) para o cliente
        userState[msg.to] = {
            ...userState[msg.to],
            waitUntilManual: Date.now() + 21600000, // 6 horas
            language: userState[msg.to]?.language || 'pt'
        };
    }
});

// Funil de mensagens recebidas
client.on('message', async msg => {
    // Ignora mensagens do próprio bot para evitar loops
    if (msg.fromMe) return;

    // Ignora mensagens de grupos
    const isGroup = msg.from.endsWith('@g.us');
    if (isGroup) return;

    const chat = await msg.getChat();
    const messageBody = msg.body ? msg.body.trim() : '';

    // Verifica se o usuário está em um período de espera (manual ou automático)
    if ((userState[msg.from]?.waitUntil && Date.now() < userState[msg.from].waitUntil) ||
        (userState[msg.from]?.waitUntilManual && Date.now() < userState[msg.from].waitUntilManual)) {
        return; // Ignora a mensagem sem responder
    }

    // Função para obter o nome do contato para notificações ao grupo
    async function getContactName() {
        let clientNameForNotification = null;
        let isIgnored = false;
        let isClient = false;
        let greetingName = '';

        try {
            const contact = await msg.getContact();
            if (contact && contact.name && contact.name.trim() !== '' && !/^\+?\d[\d\s-]*$/.test(contact.name.trim())) {
                const trimmedName = contact.name.trim();
                if (trimmedName.startsWith('-')) {
                    isIgnored = true;
                } else if (trimmedName.startsWith('#')) {
                    isClient = true;
                    greetingName = userState[msg.from]?.language === 'en' ? 'dear client' : 'querido cliente';
                    const nameAfterHash = trimmedName.substring(1).trim();
                    clientNameForNotification = nameAfterHash.split(/\s+/)[0] || null;
                } else {
                    clientNameForNotification = trimmedName.split(/\s+/)[0];
                }
            } else {
                clientNameForNotification = msg.from;
            }
        } catch (error) {
            console.error('Erro ao obter contato:', error);
            clientNameForNotification = msg.from;
        }
        return { greetingName, clientNameForNotification, isClient, isIgnored };
    }

    // Obtém o nome e verifica se é cliente ou ignorado
    const { greetingName, clientNameForNotification, isClient, isIgnored } = await getContactName();
    if (isClient || isIgnored) {
        if (isClient) {
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            const clientMessage = userState[msg.from]?.language === 'en' 
                ? 'Dear client, we will assist you shortly, please wait a moment' 
                : 'Querido cliente, logo mais iremos atendê-lo, aguarde um momento';
            await client.sendMessage(msg.from, clientMessage);
            // Define o tempo de espera de 5 minutos (300000 ms) para clientes com '#'
            userState[msg.from] = {
                ...userState[msg.from],
                waitUntil: Date.now() + 300000,
                language: userState[msg.from]?.language || 'pt'
            };
            try {
                const groupId = '(completar com informação)';
                const notificationMessage = `O cliente ${clientNameForNotification || msg.from} está enviando uma mensagem.`;
                await client.sendMessage(groupId, notificationMessage);
            } catch (error) {
                console.error('Erro ao enviar notificação para o grupo (cliente com #):', error);
            }
        }
        return;
    }

    // Define o idioma uma vez, antes do switch
    const language = userState[msg.from]?.language || 'pt';

    // Função para obter a saudação por horário
    function getGreeting(language = 'pt') {
        const hour = new Date().getHours();
        if (language === 'en') {
            if (hour >= 5 && hour < 12) return 'Good morning';
            if (hour >= 12 && hour < 18) return 'Good afternoon';
            return 'Good evening';
        } else {
            if (hour >= 5 && hour < 12) return 'Bom dia';
            if (hour >= 12 && hour < 18) return 'Boa tarde';
            return 'Boa noite';
        }
    }

    // Função para mapear a opção de processo migratório para o nome
    function getProcessName(option, language = 'pt') {
        const processMap = language === 'en' ? {
            '1': 'Naturalization',
            '2': 'Visa',
            '3': 'Residence',
            '4': 'Refugee',
            '5': 'Others'
        } : {
            '1': 'Naturalização',
            '2': 'Visto',
            '3': 'Residência',
            '4': 'Refúgio',
            '5': 'Outros'
        };
        return processMap[option] || (language === 'en' ? 'Unknown' : 'Desconhecido');
    }

    // Mensagem padrão para análise preliminar
    const analysisMessage = {
        pt: `Perfeito😊 Nesse caso, para garantir a segurança jurídica e clareza no seu processo, trabalhamos com uma análise preliminar especializada, etapa indispensável para verificar a viabilidade e indicar o melhor caminho.
🔎 O que está incluso na análise preliminar ((completar com informação)):
• Relatório jurídico escrito e assinado;
• Videoconferência de até 30 minutos para detalhar cada ponto do relatório.
⏱️ Prazo de entrega: até 7 dias úteis após a confirmação do pagamento.
💳 Formas de pagamento:
• PIX: (completar com informação)
• (completar com link) (cartão de crédito ou débito).
⚖️ Bônus: Caso a contratação dos serviços completos seja formalizada em até 30 dias após a entrega do relatório, o valor pago pela análise será integralmente abatido do contrato.
👉 Se não houver interesse em realizar a análise preliminar e desejar apenas fornecer informações do seu caso, responderemos por ordem cronológica assim que possível.
\n
1 - Desejo a análise preliminar
2 - Desejo apenas fornecer informações do meu caso
3 - Voltar`,
        en: `Perfect 😊 To ensure legal security and clarity in your process, we work with a specialized preliminary analysis, an essential step to verify feasibility and indicate the best path.
🔎 What is included in the preliminary analysis ((completar com informação)):
• Written and signed legal report;
• Video conference of up to 30 minutes to detail each point of the report.
⏱️ Delivery time: up to 7 business days after payment confirmation.
💳 Payment methods:
• PIX: (completar com informação)
• (completar com link) (credit or debit card).
⚖️ Bonus: If the full service contract is formalized within 30 days after the report delivery, the amount paid for the analysis will be fully deducted from the contract.
👉 If you are not interested in the preliminary analysis and wish to provide information about your case, we will respond in chronological order as soon as possible.
\n
1 - I want the preliminary analysis
2 - I want to provide information about my case
3 - Go back`
    };

    // Função para enviar notificação ao grupo (em português)
    async function sendGroupNotification(clientName, userId, option, context = 'default') {
        const groupId = '(completar com informação)';
        try {
            let notificationMessage;
            if (context === 'details') {
                const processName = getProcessName(option, 'pt');
                notificationMessage = `O cliente ${clientName || userId} está entrando em contato para dar os detalhes do seu caso de ${processName}.`;
            } else if (context === 'hash') {
                notificationMessage = `O cliente ${clientName || userId} está enviando uma mensagem.`;
            } else if (context === 'file') {
                const processName = getProcessName(option, 'pt');
                notificationMessage = `O cliente ${clientName || userId} enviou um arquivo (comprovante ou documento) relacionado ao processo de ${processName}.`;
            } else {
                const processName = getProcessName(option, 'pt');
                notificationMessage = `O cliente ${clientName || userId} está entrando em contato (opção ${processName}).`;
            }
            await client.sendMessage(groupId, notificationMessage);
        } catch (sendError) {
            console.error('Erro ao enviar notificação para o grupo:', sendError);
        }
    }

    // Fluxo de mensagens recebidas
    switch (true) {
        case messageBody.match(/(menu|Menu|dia|tarde|noite|oi|Oi|Olá|olá|ola|Ola|good|hi|hello)/i) !== null:
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            const greeting = getGreeting(language);
            const welcomeMessage = `${greeting}! Seja bem-vindo à (completar com informação).`;
            await client.sendMessage(msg.from, `${welcomeMessage} Por favor, selecione a linguagem desejada para contato:\n\n1 - Português \n2 - English`);
            userState[msg.from] = { state: 'awaiting_language', processOption: null, language: 'pt' };
            break;

        case messageBody === '1' && userState[msg.from]?.state === 'awaiting_language':
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(msg.from, 'Então continuaremos em português. Por favor, informe o tipo de processo migratório que gostaria de atendimento:\n\n1 - Naturalização \n2 - Visto\n3 - Residência\n4 - Refúgio\n5 - Outros');
            userState[msg.from] = { state: 'awaiting_migratory_option', processOption: null, language: 'pt' };
            break;

        case messageBody === '2' && userState[msg.from]?.state === 'awaiting_language':
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(msg.from, 'Great! Please inform the type of immigration process you need assistance with:\n\n1 - Naturalization \n2 - Visa\n3 - Residence\n4 - Refugee\n5 - Others');
            userState[msg.from] = { state: 'awaiting_migratory_option', processOption: null, language: 'en' };
            break;

        case messageBody.match(/^[1-4]$/) && userState[msg.from]?.state === 'awaiting_migratory_option':
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(msg.from, analysisMessage[language]);
            userState[msg.from] = { state: 'awaiting_analysis_choice', processOption: messageBody, language };
            break;

        case messageBody === '1' && userState[msg.from]?.state === 'awaiting_analysis_choice':
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            const responseMessage = language === 'en' 
                ? 'Ok, please send the payment receipt and all relevant documents for analysis. (completar com informação) will contact you, please wait.'
                : 'Ok, nos mande o comprovante de pagamento e todos os arquivos que achar relevante para análise. (completar com informação) entrará em contato, por favor aguarde';
            await client.sendMessage(msg.from, responseMessage);
            userState[msg.from] = { state: 'awaiting_files', processOption: userState[msg.from].processOption, language };
            break;

        case messageBody === '2' && userState[msg.from]?.state === 'awaiting_analysis_choice':
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            const responseMessage2 = language === 'en' 
                ? 'Ok, we respond in chronological order and will contact you as soon as possible.'
                : 'Ok, respondemos em ordem cronológica entraremos em contato assim que possível';
            await client.sendMessage(msg.from, responseMessage2);
            // Define o tempo de espera de 12 horas (43200000 ms)
            userState[msg.from] = {
                ...userState[msg.from],
                waitUntil: Date.now() + 43200000,
                state: null,
                language
            };
            try {
                await sendGroupNotification(clientNameForNotification, msg.from, userState[msg.from].processOption, 'details');
            } catch (error) {
                console.error('Erro ao enviar notificação para o grupo (opção 2 - fornecer informações):', error);
                await sendGroupNotification(clientNameForNotification || msg.from, msg.from, userState[msg.from]?.processOption || 'Desconhecido', 'details');
            }
            break;

        case messageBody === '3' && userState[msg.from]?.state === 'awaiting_analysis_choice':
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            const backMessage = language === 'en' 
                ? 'Great! Please inform the type of immigration process you need assistance with:\n\n1 - Naturalization \n2 - Visa\n3 - Residence\n4 - Refugee\n5 - Others'
                : 'Então continuaremos em português. Por favor, informe o tipo de processo migratório que gostaria de atendimento:\n\n1 - Naturalização \n2 - Visto\n3 - Residência\n4 - Refúgio\n5 - Outros';
            await client.sendMessage(msg.from, backMessage);
            userState[msg.from] = { state: 'awaiting_migratory_option', processOption: null, language };
            break;

        case msg.hasMedia && userState[msg.from]?.state === 'awaiting_files':
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            const fileMessage = language === 'en' 
                ? 'File received. (completar com informação) will review it and contact you soon.'
                : 'Arquivo recebido. (completar com informação) irá analisá-lo e entrará em contato em breve.';
            await client.sendMessage(msg.from, fileMessage);
            // Define o tempo de espera de 12 horas (43200000 ms)
            userState[msg.from] = {
                ...userState[msg.from],
                waitUntil: Date.now() + 43200000,
                state: null,
                language
            };
            try {
                const processOption = userState[msg.from]?.processOption || 'Desconhecido';
                await sendGroupNotification(clientNameForNotification, msg.from, processOption, 'file');
            } catch (error) {
                console.error('Erro ao enviar notificação para o grupo (arquivo recebido):', error);
                await sendGroupNotification(clientNameForNotification || msg.from, msg.from, 'Desconhecido', 'file');
            }
            break;

        case messageBody === '5' && userState[msg.from]?.state === 'awaiting_migratory_option':
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            const responseMessage5 = language === 'en' 
                ? 'Ok, type what it is about and wait a moment, we will respond in chronological order as soon as possible, we will assist you.'
                : 'Ok, digite sobre o que se trata e aguarde um instante respondemos em ordem cronológica assim que possível iremos atendê-lo';
            await client.sendMessage(msg.from, responseMessage5);
            // Define o tempo de espera de 12 horas (43200000 ms)
            userState[msg.from] = {
                ...userState[msg.from],
                waitUntil: Date.now() + 43200000,
                state: null,
                language
            };
            try {
                await sendGroupNotification(clientNameForNotification, msg.from, '5', 'default');
            } catch (error) {
                console.error('Erro ao enviar notificação para o grupo (opção 5):', error);
                await sendGroupNotification(clientNameForNotification || msg.from, msg.from, '5', 'default');
            }
            break;

        default:
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            switch (userState[msg.from]?.state) {
                case 'awaiting_language':
                    await client.sendMessage(msg.from, language === 'en' 
                        ? 'Invalid option. Please select a valid option:\n\n1 - Português \n2 - English'
                        : 'Opção inválida. Por favor, selecione uma opção válida:\n\n1 - Português \n2 - English');
                    break;
                case 'awaiting_migratory_option':
                    await client.sendMessage(msg.from, language === 'en' 
                        ? 'Invalid option. Please select a valid option:\n\n1 - Naturalization \n2 - Visa\n3 - Residence\n4 - Refugee\n5 - Others'
                        : 'Opção inválida. Por favor, selecione uma opção válida:\n\n1 - Naturalização \n2 - Visto\n3 - Residência\n4 - Refúgio\n5 - Outros');
                    break;
                case 'awaiting_analysis_choice':
                    await client.sendMessage(msg.from, language === 'en' 
                        ? 'Invalid option. Please select a valid option:\n\n1 - I want the preliminary analysis\n2 - I want to provide information about my case\n3 - Go back'
                        : 'Opção inválida. Por favor, selecione uma opção válida:\n\n1 - Desejo a análise preliminar\n2 - Desejo apenas fornecer informações do meu caso\n3 - Voltar');
                    break;
                case 'awaiting_files':
                    await client.sendMessage(msg.from, language === 'en' 
                        ? 'Please send the payment receipt or relevant documents for analysis.'
                        : 'Por favor, envie o comprovante de pagamento ou documentos relevantes para análise.');
                    break;
            }
            break;
    }
});