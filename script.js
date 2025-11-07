import {
    db
} from './firebase-config.js';
import {
    doc,
    setDoc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DE ID DA URL ---
    const params = new URLSearchParams(window.location.search);
    const fichaId = params.get('id'); // Pega o valor depois de '?id='

    if (!fichaId) {
        document.body.innerHTML = `
            <div style="color: white; text-align: center; padding: 50px; font-family: 'Special Elite', monospace;">
                <h1>Erro: ID da Ficha não encontrado.</h1>
                <p>Por favor, acesse esta página usando o link fornecido pelo mestre, que deve incluir um ID (ex: .../jogador.html?id=NOME_DO_JOGADOR).</p>
            </div>`;
        return; // Interrompe a execução do script se não houver ID
    }

    // --- ESTADO INICIAL ---
    const status = {
        pv: {
            atual: 0,
            max: 0,
            barra: document.getElementById('barra-pv'),
            texto: document.getElementById('texto-pv')
        },
        san: {
            atual: 0,
            max: 0,
            barra: document.getElementById('barra-san'),
            texto: document.getElementById('texto-san')
        },
        ph: {
            atual: 0,
            max: 0,
            barra: document.getElementById('barra-ph'),
            texto: document.getElementById('texto-ph')
        }
    };
    let ataques = [];
    let currentEditingAttackIndex = null;
    let currentEditingStat = null;
    let armaSelecionadaId = null;
    let inventario = [];
    let cargaMaxima = 8;
    let activeInputElement = null;
    let debounceTimer;
    function debounce(func, delay) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(func, delay);
    }

    // --- PERSISTÊNCIA DE DADOS (Versões corretas com Firebase) ---
    // SUBSTITUA a função saveData antiga por esta:
    async function saveData() {
        // Limpa itens vazios do final do array antes de salvar
        while (inventario.length > 0 && !inventario[inventario.length - 1].nome && !inventario[inventario.length - 1].peso) {
            inventario.pop();
        }

        const fichaData = {
            detalhes: { nome: document.getElementById('nome').value, jogador: document.getElementById('jogador').value, ocupacao: document.getElementById('ocupacao').value, idade: document.getElementById('idade').value, sexo: document.getElementById('sexo').value, nascimento: document.getElementById('nascimento').value, residencia: document.getElementById('residencia').value },
            status: { pv: { atual: status.pv.atual, max: status.pv.max }, san: { atual: status.san.atual, max: status.san.max }, ph: { atual: status.ph.atual, max: status.ph.max } },
            condicoes: { lesionado: document.getElementById('lesionado').checked, inconsciente: document.getElementById('inconsciente').checked, morrendo: document.getElementById('morrendo').checked, pertubado: document.getElementById('pertubado').checked, enlouquecido: document.getElementById('enlouquecido').checked },
            urls: { normal: document.getElementById('url-normal').value, lesionado: document.getElementById('url-lesionado').value, inconscienteMorrendo: document.getElementById('url-inconsciente-morrendo').value, pertubadoEnlouquecido: document.getElementById('url-pertubado-enlouquecido').value, lesionadoPertubado: document.getElementById('url-lesionado-pertubado').value },
            atributos: { agi: document.getElementById('attr-agi').value, 'for': document.getElementById('attr-for').value, 'int': document.getElementById('attr-int').value, pre: document.getElementById('attr-pre').value, vig: document.getElementById('attr-vig').value },
            combate: { equip: document.getElementById('equip-bonus').value, outros: document.getElementById('outros-bonus').value, desloc: document.getElementById('desloc-valor').value, esquiva: document.getElementById('esquiva-valor').value },
            pericias: {},
            ataques: ataques,
            inventario: inventario, // Salva o array de inventário
            cargaMaxima: cargaMaxima,
            armaSelecionadaId: armaSelecionadaId
        };

        document.querySelectorAll('.pericia-input').forEach(input => { fichaData.pericias[input.id] = input.value; });
        
        // A linha que percorria '.inventario-input' foi REMOVIDA.

        try {
            const docRef = doc(db, "fichas", fichaId);
            // Usar { merge: true } é uma boa prática para evitar apagar dados escritos por outra fonte (como o mestre)
            await setDoc(docRef, fichaData, { merge: true });
        } catch (e) {
        }
    }


    // --- RENDERIZAÇÃO E LÓGICA AUXILIAR ---
    function renderAttacks() {
        const lista = document.getElementById('ataques-lista');
        lista.innerHTML = '';

        // Mapa que relaciona a perícia ao seu atributo correspondente.
        // Essencial para garantir que sempre pegamos o atributo certo.
        const periciaParaAtributo = {
            acrobacia: 'agi',
            adestramento: 'pre',
            artes: 'pre',
            atletismo: 'for',
            atualidades: 'int',
            cibertecnologia: 'int',
            ciencias: 'int',
            crime: 'agi',
            diplomacia: 'pre',
            enganacao: 'pre',
            fortitude: 'vig',
            furtividade: 'agi',
            iniciativa: 'agi',
            intimidacao: 'pre',
            intuicao: 'pre',
            investigacao: 'int',
            luta: 'for',
            medicina: 'int',
            percepcao: 'pre',
            pilotagem: 'agi',
            pontaria: 'agi',
            profissao: 'int',
            psique: 'pre',
            reflexos: 'agi',
            robotica: 'int',
            sobrevivencia: 'int',
            tecnologia: 'int',
            vontade: 'pre'
        };

        ataques.forEach((ataque, index) => {
            const item = document.createElement('div');
            item.classList.add('ataque-item');
            
            const nomePericia = ataque.pericia; // ex: "luta", "acrobacia"
            const nomeAtributo = periciaParaAtributo[nomePericia]; // ex: "for", "agi"

            let atributoValor = 0;
            let treinoValor = '';
            let bonusValor = '';

            // Pega o valor do atributo principal (FOR, AGI, etc.)
            if (nomeAtributo) {
                const attrInput = document.getElementById(`attr-${nomeAtributo}`);
                if (attrInput) {
                    atributoValor = parseInt(attrInput.value) || 0;
                }
            }

            // Pega os valores de treino e bônus da perícia específica
            const treinoInput = document.getElementById(`pericia-${nomePericia}-treino`);
            const bonusInput = document.getElementById(`pericia-${nomePericia}-bonus`);
            
            if (treinoInput) {
                treinoValor = treinoInput.value.trim();
            }
            if (bonusInput) {
                bonusValor = bonusInput.value.trim();
            }
            
            const textoTeste = `${atributoValor}d20${treinoValor}${bonusValor}`;

            item.innerHTML = `
                <span class="col-ataque">${ataque.nome}</span>
                <span class="col-teste">${textoTeste}</span>
                <span class="col-dano">${ataque.dano}</span>
                <span class="col-critico">${ataque.critico}</span>
                <span class="col-alcance">${ataque.alcance}</span>
                <span class="col-tipo">${ataque.tipo}</span>
                <span class="col-acoes">
                    <button class="edit-ataque-btn" data-index="${index}">&#9998;</button>
                </span>
            `;
            lista.appendChild(item);
        });
    }

    function updateCarga() {
        let pesoTotal = 0;
        ataques.forEach(ataque => { pesoTotal += parseFloat(ataque.peso) || 0; });
        inventario.forEach(item => { pesoTotal += parseFloat(item.peso) || 0; }); // Lê do array
        document.getElementById('carga-atual').textContent = pesoTotal.toFixed(1);
        document.getElementById('carga-maxima').textContent = cargaMaxima;
    }

    function renderInventory() {
        const invEsquerda = document.getElementById('inventario-esquerda');
        const invDireita = document.getElementById('inventario-direita');
        invEsquerda.innerHTML = '';
        invDireita.innerHTML = '';

        const totalSlots = 20;
        
        for (let i = 0; i < totalSlots; i++) {
            const item = inventario[i]; // Pega o item do array, se existir
            const targetTbody = i < 10 ? invEsquerda : invDireita;

            const tr = document.createElement('tr');
            // Adiciona data-attributes para sabermos qual item e campo estamos editando
            tr.innerHTML = `
                <td><input type="text" class="inventario-input" data-index="${i}" data-field="nome" value="${item ? item.nome : ''}"></td>
                <td><input type="number" step="0.1" class="inventario-input" data-index="${i}" data-field="peso" value="${item ? item.peso : ''}"></td>
            `;
            targetTbody.appendChild(tr);
        }
    }

    function renderMunicao() {
        const container = document.getElementById('container-municao');
        container.innerHTML = '';

        const ataquesDePontaria = ataques.filter(ataque => ataque.pericia === 'pontaria');

        if (ataquesDePontaria.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        ataquesDePontaria.forEach((ataque, index) => {
            // Se uma arma está selecionada, só mostra a barra dela
            if (armaSelecionadaId && armaSelecionadaId !== ataque.nome) {
                return; // Pula a renderização das outras barras
            }
            
            // ... (código existente para garantir que os dados de munição existam) ...

            const isChecked = armaSelecionadaId === ataque.nome ? 'checked' : '';
            const barraId = `municao-${index}`;
            const barraHtml = `
                <div class="municao-barra-container">
                    <h3>— MUNIÇÃO </h3>
                    <div class="status-header">
                        <span>${ataque.nome}</span>
                        <div class="controles">
                            <input type="checkbox" class="arma-select-check" data-nome-ataque="${ataque.nome}" ${isChecked}>
                            <button class="control-btn-municao" data-action="decrease" data-index="${index}">-</button>
                            <button class="control-btn-municao" data-action="increase" data-index="${index}">+</button>
                        </div>
                    </div>
                    
                    <!-- BLOCO QUE FALTAVA ADICIONADO ABAIXO -->
                    <div class="barra-fundo barra-fundo-municao">
                        <div id="barra-${barraId}" class="barra-progresso municao"></div>
                        <div id="texto-${barraId}" class="texto-barra">
                            <span class="valor-atual">${ataque.municao.atual}</span>
                            <span>/</span>
                            <span class="valor-max">${ataque.municao.max}</span>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += barraHtml;
            atualizarBarraMunicao(ataque.municao, barraId);
        });
    }


    // NOVA FUNÇÃO: Atualiza uma barra de munição específica
    function atualizarBarraMunicao(municaoData, barraId) {
        const barraEl = document.getElementById(`barra-${barraId}`);
        const textoEl = document.getElementById(`texto-${barraId}`);
        if (!barraEl || !textoEl) return;

        const spanAtual = textoEl.querySelector('.valor-atual');
        const spanMax = textoEl.querySelector('.valor-max');

        const maxParaBarra = municaoData.max > 0 ? municaoData.max : 1;
        const porcentagem = (municaoData.atual / maxParaBarra) * 100;
        
        barraEl.style.width = `${Math.max(0, Math.min(100, porcentagem))}%`;
        spanAtual.textContent = municaoData.atual;
        spanMax.textContent = municaoData.max;

        if (municaoData.atual > municaoData.max || municaoData.atual < 0) {
            spanAtual.classList.add('excedido');
        } else {
            spanAtual.classList.remove('excedido');
        }
    }

    function updateDefense() {
        const agi = parseInt(document.getElementById('attr-agi').value) || 0;
        const equip = parseInt(document.getElementById('equip-bonus').value) || 0;
        const outros = parseInt(document.getElementById('outros-bonus').value) || 0;
        document.getElementById('defesa-total').textContent = 10 + agi + equip + outros;
    }

    function checkPericiaTraining(inputElement) {
        const row = inputElement.closest('tr');
        if (inputElement.value.trim() !== '') {
            row.classList.add('treinada');
        } else {
            row.classList.remove('treinada');
        }
    }

    function updateSkillAttributes() {
        const attributeValues = {
            agi: document.getElementById('attr-agi').value || 0,
            'for': document.getElementById('attr-for').value || 0,
            'int': document.getElementById('attr-int').value || 0,
            pre: document.getElementById('attr-pre').value || 0,
            vig: document.getElementById('attr-vig').value || 0
        };
        document.querySelectorAll('td[data-skill-attr]').forEach(cell => {
            const attrKey = cell.dataset.skillAttr;
            const attrValue = attributeValues[attrKey];
            const span = cell.querySelector('.attr-value');
            if (span) {
                span.textContent = `${attrValue}`;
            }
        });
    }

    function atualizarBarra(tipo) {
        const s = status[tipo];
        if (!s) return;

        // Pega as referências para os novos spans
        const spanAtual = s.texto.querySelector('.valor-atual');
        const spanMax = s.texto.querySelector('.valor-max');

        // Lógica da barra de progresso
        const maxParaBarra = s.max > 0 ? s.max : 1;
        const porcentagem = (s.atual / maxParaBarra) * 100;

        // A barra visual nunca pode ser negativa, então usamos Math.max(0, ...)
        s.barra.style.width = `${Math.max(0, Math.min(100, porcentagem))}%`;

        // Lógica do texto
        spanAtual.textContent = s.atual;
        spanMax.textContent = s.max;

        // Lógica da cor amarela para valores anormais (excedidos OU negativos)
        if (s.atual > s.max || s.atual < 0) {
            spanAtual.classList.add('excedido');
        } else {
            spanAtual.classList.remove('excedido');
        }
    }

    function atualizarPortrait() {
        const checkboxes = {
            lesionado: document.getElementById('lesionado').checked,
            inconsciente: document.getElementById('inconsciente').checked || document.getElementById('morrendo').checked,
            pertubado: document.getElementById('pertubado').checked || document.getElementById('enlouquecido').checked
        };
        let novaUrl = document.getElementById('url-normal').value;
        if (checkboxes.lesionado && checkboxes.pertubado) novaUrl = document.getElementById('url-lesionado-pertubado').value;
        else if (checkboxes.inconsciente) novaUrl = document.getElementById('url-inconsciente-morrendo').value;
        else if (checkboxes.lesionado) novaUrl = document.getElementById('url-lesionado').value;
        else if (checkboxes.pertubado) novaUrl = document.getElementById('url-pertubado-enlouquecido').value;
        const portraitImg = document.getElementById('portrait');
        if (portraitImg.src === novaUrl) return;
        portraitImg.style.opacity = '0';
        setTimeout(() => {
            portraitImg.src = novaUrl || 'https://i.imgur.com/cT3T7QL.png';
            portraitImg.onload = () => {
                portraitImg.style.opacity = '1';
            };
        }, 400);
    }

    // --- EVENT LISTENERS ---
    document.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            activeInputElement = e.target;
        }
    });

    document.addEventListener('focusout', () => {
        activeInputElement = null;
    });
    
    document.getElementById('ataque-pericia').addEventListener('change', (e) => {
        const campoMunicao = document.getElementById('campo-municao-max');
        if (e.target.value === 'pontaria') {
            campoMunicao.style.display = 'block';
        } else {
            campoMunicao.style.display = 'none';
        }
    });
    
    document.getElementById('add-ataque-btn').addEventListener('click', () => {
        currentEditingAttackIndex = null;
        document.getElementById('ataque-nome').value = '';
        document.getElementById('ataque-pericia').value = 'luta';
        document.getElementById('ataque-dano').value = '';
        document.getElementById('ataque-critico').value = '';
        document.getElementById('ataque-alcance').value = '';
        document.getElementById('ataque-tipo').value = '';
        document.getElementById('ataque-peso').value = '';
        document.getElementById('modal-ataque-title').textContent = 'Adicionar Novo Ataque';
        document.getElementById('salvar-ataque-btn').textContent = 'Adicionar';
        document.getElementById('deletar-ataque-btn').classList.remove('visible');
        document.getElementById('modal-gerenciar-ataque').classList.add('active');
    });
    document.getElementById('ataques-lista').addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-ataque-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            currentEditingAttackIndex = index;
            const ataque = ataques[index];
            const campoMunicao = document.getElementById('campo-municao-max');
            if (ataque.pericia === 'pontaria') {
                campoMunicao.style.display = 'block';
                document.getElementById('ataque-municao-max').value = ataque.municao?.max || 0;
            } else {
                campoMunicao.style.display = 'none';
            }
            document.getElementById('ataque-nome').value = ataque.nome;
            document.getElementById('ataque-pericia').value = ataque.pericia;
            document.getElementById('ataque-dano').value = ataque.dano;
            document.getElementById('ataque-critico').value = ataque.critico;
            document.getElementById('ataque-alcance').value = ataque.alcance;
            document.getElementById('ataque-tipo').value = ataque.tipo;
            document.getElementById('ataque-peso').value = ataque.peso || '';
            document.getElementById('modal-ataque-title').textContent = 'Editar Ataque';
            document.getElementById('salvar-ataque-btn').textContent = 'Salvar Alterações';
            document.getElementById('deletar-ataque-btn').classList.add('visible');
            document.getElementById('modal-gerenciar-ataque').classList.add('active');
        }
    });
    document.getElementById('salvar-ataque-btn').addEventListener('click', () => {
        const ataqueData = {
            nome: document.getElementById('ataque-nome').value,
            pericia: document.getElementById('ataque-pericia').value,
            dano: document.getElementById('ataque-dano').value,
            critico: document.getElementById('ataque-critico').value,
            alcance: document.getElementById('ataque-alcance').value,
            tipo: document.getElementById('ataque-tipo').value,
            peso: document.getElementById('ataque-peso').value
        };
        if (ataqueData.pericia === 'pontaria') {
            const municaoMax = parseInt(document.getElementById('ataque-municao-max').value, 10) || 0;
            ataqueData.municao = {
                atual: municaoMax,
                max: municaoMax
            };
        }

        // Se estiver editando um ataque que já tinha munição, preserva o valor atual
        if (currentEditingAttackIndex !== null && ataques[currentEditingAttackIndex]?.municao) {
            const municaoAtualAntiga = ataques[currentEditingAttackIndex].municao.atual;
            if (ataqueData.municao) { // Se o ataque continua sendo de pontaria
                ataqueData.municao.atual = municaoAtualAntiga;
            }
        }
        
        if (currentEditingAttackIndex === null) { ataques.push(ataqueData); } 
        else { ataques[currentEditingAttackIndex] = ataqueData; }

        debounce(saveData, 200); // Salva imediatamente após fechar o modal
        renderAttacks();
        renderMunicao(); // Re-renderiza as barras de munição
        updateCarga();
        document.getElementById('modal-gerenciar-ataque').classList.remove('active');
    });

    document.getElementById('container-municao').addEventListener('click', (e) => {
        const target = e.target;

        if (target.classList.contains('arma-select-check')) {
            const nomeAtaque = target.dataset.nomeAtaque;
            if (target.checked) {
                armaSelecionadaId = nomeAtaque;
            } else {
                armaSelecionadaId = null;
            }
            saveData(); // Salva imediatamente ao selecionar/desselecionar
            renderMunicao(); // Precisa recriar tudo para mostrar/esconder as barras
            return;
        }
        
        if (target.classList.contains('control-btn-municao')) {
            const nomeAtaque = target.closest('.municao-barra-container').querySelector('.status-header span').textContent;
            const action = target.dataset.action;
            
            const ataqueAlvo = ataques.find(ataque => ataque.nome === nomeAtaque);
            if (!ataqueAlvo) return;

            if (action === 'increase') {
                ataqueAlvo.municao.atual++;
            } else if (action === 'decrease') {
                ataqueAlvo.municao.atual--;
            }

            debounce(saveData, 500);
            
            // CORREÇÃO: Encontra o índice e chama a função de atualização específica
            const ataquesDePontaria = ataques.filter(a => a.pericia === 'pontaria');
            const indexNaListaPontaria = ataquesDePontaria.findIndex(a => a.nome === ataqueAlvo.nome);
            const barraId = `municao-${indexNaListaPontaria}`;
            
            atualizarBarraMunicao(ataqueAlvo.municao, barraId); // <-- CHAMADA CORRIGIDA
        }
    });


    document.querySelector('.inventario-colunas').addEventListener('input', (e) => {
        if (e.target.classList.contains('inventario-input')) {
            const index = parseInt(e.target.dataset.index, 10);
            const field = e.target.dataset.field; // "nome" ou "peso"

            // Garante que o objeto existe no array antes de modificá-lo
            while (inventario.length <= index) {
                inventario.push({ nome: '', peso: 0 });
            }

            // Atualiza o valor no array
            inventario[index][field] = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;

            // Se o campo de peso foi alterado, atualiza a carga
            if (field === 'peso') {
                updateCarga();
            }
            debounce(saveData, 900);
        }
    });
    document.getElementById('carga-max-container').addEventListener('click', () => {
        document.getElementById('carga-max-input').value = cargaMaxima;
        document.getElementById('modal-carga-max').classList.add('active');
    });
    document.getElementById('salvar-carga-max-btn').addEventListener('click', () => {
        const novoMax = parseInt(document.getElementById('carga-max-input').value, 10);
        if (!isNaN(novoMax) && novoMax >= 0) {
            cargaMaxima = novoMax;
            updateCarga();
            saveData();
            document.getElementById('modal-carga-max').classList.remove('active');
        }
    });
    document.getElementById('deletar-ataque-btn').addEventListener('click', () => {
        if (currentEditingAttackIndex !== null) {
            ataques.splice(currentEditingAttackIndex, 1);
            saveData();
            renderAttacks();
            updateCarga();
            document.getElementById('modal-gerenciar-ataque').classList.remove('active');
        }
    });
    document.querySelectorAll('.control-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const stat = e.target.dataset.stat;
            if (action === 'increase') {
                status[stat].atual++;
            } else if (action === 'decrease') {
                status[stat].atual--;
            }
            atualizarBarra(stat);
            saveData();
        });
    });
    const modalPortraits = document.getElementById('modal-portraits');
    document.getElementById('portrait-container').addEventListener('click', () => modalPortraits.classList.add('active'));
    document.getElementById('adicionar-urls').addEventListener('click', () => {
        modalPortraits.classList.remove('active');
        atualizarPortrait();
        saveData();
    });
    const modalStats = document.getElementById('modal-stats');
    document.querySelectorAll('.status-container').forEach(container => {
        container.addEventListener('click', (e) => {
            if (e.target.closest('.condicoes') || e.target.closest('.controles')) return;
            currentEditingStat = e.currentTarget.dataset.stat;
            const statName = e.currentTarget.dataset.statName;
            document.getElementById('modal-stats-title').textContent = `Adicione ou Remova ${statName}`;
            document.getElementById('stat-atual-label').textContent = `${statName} Atual`;
            document.getElementById('stat-max-label').textContent = `${statName} Máximo`;
            document.getElementById('stat-atual').value = status[currentEditingStat].atual;
            document.getElementById('stat-max').value = status[currentEditingStat].max;
            modalStats.classList.add('active');
        });
    });
    document.getElementById('salvar-stat').addEventListener('click', () => {
        if (currentEditingStat) {
            const novoAtual = parseInt(document.getElementById('stat-atual').value, 10);
            const novoMax = parseInt(document.getElementById('stat-max').value, 10);
            if (!isNaN(novoAtual)) status[currentEditingStat].atual = novoAtual;
            if (!isNaN(novoMax)) status[currentEditingStat].max = novoMax;
            if (status[currentEditingStat].atual > status[currentEditingStat].max) status[currentEditingStat].atual = status[currentEditingStat].max;
            atualizarBarra(currentEditingStat);
            modalStats.classList.remove('active');
            saveData();
        }
    });
    document.getElementById('resetar-stat').addEventListener('click', () => {
        if (currentEditingStat) {
            status[currentEditingStat].atual = status[currentEditingStat].max;
            atualizarBarra(currentEditingStat);
            modalStats.classList.remove('active');
            saveData();
        }
    });
    document.querySelectorAll('.close-button').forEach(btn => btn.addEventListener('click', () => document.getElementById(btn.dataset.modalId).classList.remove('active')));
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) event.target.classList.remove('active');
    });
    document.querySelectorAll('.condicoes input').forEach(checkbox => checkbox.addEventListener('change', () => {
        atualizarPortrait();
        debounce(saveData, 900);
    }));
    const inputsToSave = document.querySelectorAll('.detalhes-pessoais input, .detalhes-pessoais select');
    inputsToSave.forEach(input => input.addEventListener('input', () => debounce(saveData, 500)));
    const attrInputs = document.querySelectorAll('.attr-input');
    attrInputs.forEach(input => {
        input.addEventListener('input', () => {
            if (input.dataset.attr === 'agi') updateDefense();
            updateSkillAttributes();
            renderAttacks();
            updateCarga();
            debounce(saveData, 900);
        });
    });
    const combatInputs = document.querySelectorAll('#equip-bonus, #outros-bonus, #desloc-valor, #esquiva-valor');
    combatInputs.forEach(input => {
        input.addEventListener('input', () => {
            if (input.id === 'equip-bonus' || input.id === 'outros-bonus') updateDefense();
            debounce(saveData, 900);
        });
    });
    const periciaInputs = document.querySelectorAll('.pericia-input');
    periciaInputs.forEach(input => {
        input.addEventListener('input', () => {
            if (input.id.includes('-treino')) {
                checkPericiaTraining(input);
            }
            if (input.id === 'pericia-luta-treino' || input.id === 'pericia-pontaria-treino') {
                renderAttacks();
            }
            debounce(saveData, 900);
        });
    });

    function renderAll() {
        Object.keys(status).forEach(atualizarBarra);
        atualizarPortrait();
        updateDefense();
        renderAttacks();
        renderInventory();
        renderMunicao();
        updateCarga();
        
        // As funções de estilo das perícias ainda precisam rodar
        document.querySelectorAll('input[id*="-treino"]').forEach(input => checkPericiaTraining(input));
        updateSkillAttributes();
    }

    // A função principal que escuta o Firebase e atualiza a ficha
    onSnapshot(doc(db, "fichas", fichaId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();

            // Atualiza as variáveis de estado do script (isso é seguro)
            status.pv.atual = data.status?.pv.atual ?? 0;
            status.pv.max = data.status?.pv.max ?? 0;
            status.san.atual = data.status?.san.atual ?? 0;
            status.san.max = data.status?.san.max ?? 0;
            status.ph.atual = data.status?.ph.atual ?? 0;
            status.ph.max = data.status?.ph.max ?? 0;
            ataques = data.ataques || [];
            inventario = data.inventario || [];
            cargaMaxima = data.cargaMaxima || 8;
            armaSelecionadaId = data.armaSelecionadaId || null;
            
            // ATUALIZAÇÃO INTELIGENTE: Só atualiza os campos que não estão em foco
            
            // Detalhes Pessoais
            Object.keys(data.detalhes || {}).forEach(key => {
                const input = document.getElementById(key);
                if (input && input !== activeInputElement) {
                    input.value = data.detalhes[key];
                }
            });

            // Atributos
            Object.keys(data.atributos || {}).forEach(key => {
                const inputId = `attr-${key === 'for' ? 'for' : key}`; // Lida com o 'for' que é uma palavra reservada
                const input = document.getElementById(inputId);
                if (input && input !== activeInputElement) {
                    input.value = data.atributos[key];
                }
            });

            // Perícias
            Object.keys(data.pericias || {}).forEach(key => {
                const input = document.getElementById(key);
                if (input && input !== activeInputElement) {
                    input.value = data.pericias[key];
                }
            });

            // Re-renderiza apenas as seções que são seguras de recriar
            renderAll();
        } else {
            renderAll();
        }
    });


    // --- INICIALIZAÇÃO ---
    // A inicialização agora é só renderizar os slots vazios uma vez.
    // O onSnapshot cuidará de preenchê-los.
    renderInventory();

});
