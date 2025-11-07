import { db } from './firebase-config.js';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DA PÁGINA ---
    const carregarBtn = document.getElementById('carregar-jogadores-btn');
    const jogador1IdInput = document.getElementById('jogador1-id-input');
    const jogador2IdInput = document.getElementById('jogador2-id-input');
    
    const addItemBtn = document.getElementById('add-item-mestre-btn');
    const itemModal = document.getElementById('modal-gerenciar-item-mestre');
    const itemModalTitle = document.getElementById('modal-item-title');
    const saveItemBtn = document.getElementById('salvar-item-mestre-btn');
    const deleteItemBtn = document.getElementById('deletar-item-mestre-btn');
    const itemNameInput = document.getElementById('item-mestre-nome');
    const itemPesoInput = document.getElementById('item-mestre-peso');
    const listaItensMestre = document.getElementById('lista-itens-mestre');

    const entregarModal = document.getElementById('modal-entregar');
    const entregarBtnJ1 = document.getElementById('entregar-jogador1-btn');
    const entregarBtnJ2 = document.getElementById('entregar-jogador2-btn');
    const addAtaqueBtn = document.getElementById('add-ataque-mestre-btn');
    const ataqueModal = document.getElementById('modal-gerenciar-ataque-mestre');
    const ataqueModalTitle = document.getElementById('modal-ataque-title-mestre');
    const saveAtaqueBtn = document.getElementById('salvar-ataque-mestre-btn');
    const deleteAtaqueBtn = document.getElementById('deletar-ataque-mestre-btn');
    const listaAtaquesMestre = document.getElementById('lista-ataques-mestre');

    // --- ESTADO DO PAINEL ---
    let unsubJogador1 = null;
    let unsubJogador2 = null;
    let loadedPlayerIds = { 1: null, 2: null };
    let mestreInventario = [];
    let currentEditingItemIndex = null;
    let itemParaEntregar = null;
    let mestreAtaques = []; // Array para os ataques do mestre
    let currentEditingAtaqueIndex = null;
    let ataqueParaEntregar = null;

    // --- LÓGICA DE DADOS DO MESTRE ---
    async function saveMestreData() {
        try {
            const docRef = doc(db, "mestre", "painel");
            await setDoc(docRef, { inventario: mestreInventario });
            console.log("Inventário do mestre salvo!");
        } catch (e) { console.error("Erro ao salvar dados do mestre: ", e); }
    }

    async function loadMestreData() {
        const docRef = doc(db, "mestre", "painel");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            mestreInventario = data.inventario || [];
            renderMestreItens();
        }
    }

    function renderMestreItens() {
        listaItensMestre.innerHTML = '';
        mestreInventario.forEach((item, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item.nome} (Peso: ${item.peso})</span>
                <div>
                    <button class="edit-item-btn" data-index="${index}">&#9998;</button>
                    <button class="entregar-btn" data-index="${index}">Entregar</button>
                </div>
            `;
            listaItensMestre.appendChild(li);
        });
    }

    function renderMestreAtaques() {
        listaAtaquesMestre.innerHTML = '';
        mestreAtaques.forEach((ataque, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${ataque.nome} (${ataque.dano})</span>
                <div>
                    <button class="edit-ataque-btn" data-index="${index}">&#9998;</button>
                    <button class="entregar-btn" data-type="ataque" data-index="${index}">Entregar</button>
                </div>
            `;
            listaAtaquesMestre.appendChild(li);
        });
    }

    // --- LÓGICA DE VISUALIZAÇÃO DOS JOGADORES (COMPLETA) ---
    function listenToPlayer(playerId, cardIndex) {
        const docRef = doc(db, "fichas", playerId);
        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                updatePlayerCard(data, cardIndex);
            } else {
                console.log(`Ficha para ${playerId} não encontrada.`);
                resetPlayerCard(cardIndex);
            }
        });
        return unsubscribe;
    }

    function updatePlayerCard(data, cardIndex) {
        const portraitImg = document.getElementById(`portrait-jogador${cardIndex}`);
        const pvEl = document.getElementById(`pv-jogador${cardIndex}`);
        const sanEl = document.getElementById(`san-jogador${cardIndex}`);
        const phEl = document.getElementById(`ph-jogador${cardIndex}`);
        const municaoContainer = document.getElementById(`municao-jogador${cardIndex}`);
        const municaoValor = document.getElementById(`municao-valor-jogador${cardIndex}`);
        let portraitUrl = data.urls?.normal || 'https://i.imgur.com/cT3T7QL.png';
        if (data.condicoes) {
            const { lesionado, inconsciente, morrendo, pertubado, enlouquecido } = data.condicoes;
            if (lesionado && (pertubado || enlouquecido)) portraitUrl = data.urls.lesionadoPertubado;
            else if (inconsciente || morrendo) portraitUrl = data.urls.inconscienteMorrendo;
            else if (lesionado) portraitUrl = data.urls.lesionado;
            else if (pertubado || enlouquecido) portraitUrl = data.urls.pertubadoEnlouquecido;
        }
        portraitImg.src = portraitUrl;
        pvEl.textContent = `${data.status?.pv.atual || 0}/${data.status?.pv.max || 0}`;
        sanEl.textContent = `${data.status?.san.atual || 0}/${data.status?.san.max || 0}`;
        phEl.textContent = data.status?.ph.atual || 0;
        const armaSelecionadaId = data.armaSelecionadaId;
    
    if (armaSelecionadaId) {
        // Encontra o ataque selecionado na lista de ataques
        const arma = data.ataques?.find(ataque => ataque.nome === armaSelecionadaId);
        
        if (arma && arma.municao) {
            municaoContainer.style.display = 'flex'; // Mostra o contêiner
            municaoValor.textContent = `X ${arma.municao.atual}`;
        } else {
            municaoContainer.style.display = 'none'; // Esconde se a arma não for encontrada ou não tiver munição
        }
    } else {
        // Se nenhuma arma estiver selecionada, esconde o contêiner
        municaoContainer.style.display = 'none';
    }
    }
    
    function resetPlayerCard(cardIndex) {
        document.getElementById(`portrait-jogador${cardIndex}`).src = 'https://i.imgur.com/cT3T7QL.png';
        document.getElementById(`pv-jogador${cardIndex}`).textContent = 'N/A';
        document.getElementById(`san-jogador${cardIndex}`).textContent = 'N/A';
        document.getElementById(`ph-jogador${cardIndex}`).textContent = 'N/A';
    }

    function carregarFichasSalvas() {
        const savedId1 = localStorage.getItem('mestre-jogador1-id');
        const savedId2 = localStorage.getItem('mestre-jogador2-id');

        if (savedId1) {
            jogador1IdInput.value = savedId1;
        }
        if (savedId2) {
            jogador2IdInput.value = savedId2;
        }

        // Se encontramos algum ID salvo, clicamos no botão "Carregar" automaticamente
        if (savedId1 || savedId2) {
            carregarBtn.click();
        }
    }


    // --- EVENT LISTENERS ---
    carregarBtn.addEventListener('click', () => {
        if (unsubJogador1) unsubJogador1();
        if (unsubJogador2) unsubJogador2();

        const id1 = jogador1IdInput.value.trim();
        const id2 = jogador2IdInput.value.trim();
        
        // SALVA os IDs no localStorage
        localStorage.setItem('mestre-jogador1-id', id1);
        localStorage.setItem('mestre-jogador2-id', id2);

        loadedPlayerIds = { 1: id1, 2: id2 };

        if (id1) { unsubJogador1 = listenToPlayer(id1, 1); } else { resetPlayerCard(1); }
        if (id2) { unsubJogador2 = listenToPlayer(id2, 2); } else { resetPlayerCard(2); }
    });

    // Itens
    addItemBtn.addEventListener('click', () => { currentEditingItemIndex = null; itemModalTitle.textContent = 'Adicionar Novo Item'; saveItemBtn.textContent = 'Adicionar'; itemNameInput.value = ''; itemPesoInput.value = ''; deleteItemBtn.classList.remove('visible'); itemModal.classList.add('active'); });
    saveItemBtn.addEventListener('click', () => { const itemData = { nome: itemNameInput.value.trim(), peso: parseFloat(itemPesoInput.value) || 0 }; if (!itemData.nome) return; if (currentEditingItemIndex === null) { mestreInventario.push(itemData); } else { mestreInventario[currentEditingItemIndex] = itemData; } saveMestreData(); renderMestreItens(); itemModal.classList.remove('active'); });
    deleteItemBtn.addEventListener('click', () => { if (currentEditingItemIndex !== null) { mestreInventario.splice(currentEditingItemIndex, 1); saveMestreData(); renderMestreItens(); itemModal.classList.remove('active'); } });

    // Ataques
    addAtaqueBtn.addEventListener('click', () => {
        currentEditingAtaqueIndex = null;
        ataqueModalTitle.textContent = 'Adicionar Novo Ataque';
        saveAtaqueBtn.textContent = 'Adicionar';
        document.getElementById('ataque-mestre-nome').value = ''; document.getElementById('ataque-mestre-pericia').value = 'luta'; document.getElementById('ataque-mestre-dano').value = ''; document.getElementById('ataque-mestre-critico').value = ''; document.getElementById('ataque-mestre-alcance').value = 'Corpo-a-corpo'; document.getElementById('ataque-mestre-tipo').value = 'Impacto'; document.getElementById('ataque-mestre-peso').value = '';
        deleteAtaqueBtn.classList.remove('visible');
        ataqueModal.classList.add('active');
    });
    saveAtaqueBtn.addEventListener('click', () => {
        const ataqueData = { nome: document.getElementById('ataque-mestre-nome').value, pericia: document.getElementById('ataque-mestre-pericia').value, dano: document.getElementById('ataque-mestre-dano').value, critico: document.getElementById('ataque-mestre-critico').value, alcance: document.getElementById('ataque-mestre-alcance').value, tipo: document.getElementById('ataque-mestre-tipo').value, peso: parseFloat(document.getElementById('ataque-mestre-peso').value) || 0 };
        if (!ataqueData.nome) return;
        if (currentEditingAtaqueIndex === null) { mestreAtaques.push(ataqueData); } else { mestreAtaques[currentEditingAtaqueIndex] = ataqueData; }
        saveMestreData(); renderMestreAtaques(); ataqueModal.classList.remove('active');
    });
    deleteAtaqueBtn.addEventListener('click', () => { if (currentEditingAtaqueIndex !== null) { mestreAtaques.splice(currentEditingAtaqueIndex, 1); saveMestreData(); renderMestreAtaques(); ataqueModal.classList.remove('active'); } });

    // Edição / Entrega
    function handleListClick(event, type) {
        const target = event.target;
        if (!target.dataset.index) return;
        const index = parseInt(target.dataset.index, 10);
        if (target.classList.contains('edit-item-btn') || target.classList.contains('edit-ataque-btn')) {
            if (type === 'item') {
                currentEditingItemIndex = index; const item = mestreInventario[index]; itemModalTitle.textContent = 'Editar Item'; saveItemBtn.textContent = 'Salvar Alterações'; itemNameInput.value = item.nome; itemPesoInput.value = item.peso; deleteItemBtn.classList.add('visible'); itemModal.classList.add('active');
            } else {
                currentEditingAtaqueIndex = index; const ataque = mestreAtaques[index]; ataqueModalTitle.textContent = 'Editar Ataque'; saveAtaqueBtn.textContent = 'Salvar Alterações';
                document.getElementById('ataque-mestre-nome').value = ataque.nome; document.getElementById('ataque-mestre-pericia').value = ataque.pericia; document.getElementById('ataque-mestre-dano').value = ataque.dano; document.getElementById('ataque-mestre-critico').value = ataque.critico; document.getElementById('ataque-mestre-alcance').value = ataque.alcance; document.getElementById('ataque-mestre-tipo').value = ataque.tipo; document.getElementById('ataque-mestre-peso').value = ataque.peso;
                deleteAtaqueBtn.classList.add('visible'); ataqueModal.classList.add('active');
            }
        }
        if (target.classList.contains('entregar-btn')) {
            if (type === 'item') { itemParaEntregar = mestreInventario[index]; } else { ataqueParaEntregar = mestreAtaques[index]; }
            entregarBtnJ1.textContent = `Jogador 1 (${loadedPlayerIds[1] || 'Vazio'})`; entregarBtnJ2.textContent = `Jogador 2 (${loadedPlayerIds[2] || 'Vazio'})`;
            entregarModal.dataset.entregaType = type;
            entregarModal.classList.add('active');
        }
    }
    listaItensMestre.addEventListener('click', (e) => handleListClick(e, 'item'));
    listaAtaquesMestre.addEventListener('click', (e) => handleListClick(e, 'ataque'));
    async function entregar(playerIndex) {
        const playerId = loadedPlayerIds[playerIndex];
        const type = entregarModal.dataset.entregaType;
        if (!playerId || (!itemParaEntregar && !ataqueParaEntregar)) return;
        const docRef = doc(db, "fichas", playerId);
        if (type === 'item') { await updateDoc(docRef, { inventario: arrayUnion(itemParaEntregar) }); console.log(`'${itemParaEntregar.nome}' entregue para ${playerId}`); } 
        else { await updateDoc(docRef, { ataques: arrayUnion(ataqueParaEntregar) }); console.log(`'${ataqueParaEntregar.nome}' entregue para ${playerId}`); }
        entregarModal.classList.remove('active');
    }
    entregarBtnJ1.addEventListener('click', () => entregar(1));
    entregarBtnJ2.addEventListener('click', () => entregar(2));
    document.querySelectorAll('.close-button').forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.modal').classList.remove('active')));
    
    loadMestreData();
    carregarFichasSalvas();
});
