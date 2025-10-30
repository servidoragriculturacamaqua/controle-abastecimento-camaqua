// --- 1. CONFIGURAÇÃO DO CLIENTE SUPABASE ---
const SUPABASE_URL = 'https://exrglbxgoizdksyllmse.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cmdsYnhnb2l6ZGtzeWxsbXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzM1MzgsImV4cCI6MjA3NzM0OTUzOH0.yZ7vry7e_cqlODwzbFkZZSPQSDWOI4nl10LJBPhudIA';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. SELETORES GLOBAIS ---
const navAbastecimento = document.getElementById('nav-abastecimento');
const navVeiculos = document.getElementById('nav-veiculos');
const sectionAbastecimento = document.getElementById('section-abastecimento');
const sectionVeiculos = document.getElementById('section-veiculos');
const infoMaquinaCard = document.getElementById('info-maquina');

// --- 3. LÓGICA DE NAVEGAÇÃO ENTRE ABAS ---
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    
    if (sectionId === 'section-abastecimento') {
        navAbastecimento.classList.add('active');
    } else {
        navVeiculos.classList.add('active');
        carregarListaVeiculos();
    }
}

navAbastecimento.addEventListener('click', () => showSection('section-abastecimento'));
navVeiculos.addEventListener('click', () => showSection('section-veiculos'));

// --- 4. LÓGICA DE GERENCIAMENTO DE VEÍCULOS (CRUD) ---
const modal = document.getElementById('veiculo-modal');
const modalTitle = document.getElementById('modal-title');
const veiculoForm = document.getElementById('veiculo-form');
const veiculoIdInput = document.getElementById('veiculo-id');
const veiculoNomeInput = document.getElementById('veiculo-nome');
const veiculoTipoInput = document.getElementById('veiculo-tipo');
const listaVeiculosBody = document.getElementById('lista-veiculos');

async function carregarListaVeiculos() {
    listaVeiculosBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    try {
        const { data, error } = await supabaseClient.from('veiculos').select('*').order('nome');
        if (error) throw error;
        listaVeiculosBody.innerHTML = '';
        if (data.length === 0) {
            listaVeiculosBody.innerHTML = '<tr><td colspan="3">Nenhum veículo cadastrado.</td></tr>';
            return;
        }
        data.forEach(veiculo => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${veiculo.nome}</td>
                <td>${veiculo.tipo || ''}</td>
                <td class="actions">
                    <button class="btn btn-sm" onclick="openModalForEdit(${veiculo.id},'${veiculo.nome.replace(/'/g, "\\'")}','${(veiculo.tipo || '').replace(/'/g, "\\'")}')">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="excluirVeiculo(${veiculo.id})">Excluir</button>
                </td>`;
            listaVeiculosBody.appendChild(tr);
        });
    } catch (error) { console.error('Erro ao carregar lista de veículos:', error); }
}

function openModalForCreate() { veiculoForm.reset(); veiculoIdInput.value = ''; modalTitle.textContent = 'Adicionar Novo Veículo'; modal.style.display = 'flex'; }
function openModalForEdit(id, nome, tipo) { veiculoForm.reset(); veiculoIdInput.value = id; veiculoNomeInput.value = nome; veiculoTipoInput.value = tipo; modalTitle.textContent = 'Editar Veículo'; modal.style.display = 'flex'; }
function closeModal() { modal.style.display = 'none'; }

document.getElementById('btn-novo-veiculo').addEventListener('click', openModalForCreate);
document.querySelector('.close-button').addEventListener('click', closeModal);
window.addEventListener('click', (event) => { if (event.target == modal) closeModal(); });

veiculoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = veiculoIdInput.value;
    const veiculoData = { nome: veiculoNomeInput.value, tipo: veiculoTipoInput.value };
    try {
        const { error } = id ? await supabaseClient.from('veiculos').update(veiculoData).eq('id', id) : await supabaseClient.from('veiculos').insert([veiculoData]);
        if (error) throw error;
        closeModal();
        carregarListaVeiculos();
        carregarVeiculosDropdown();
    } catch (error) { console.error('Erro ao salvar veículo:', error); alert('Falha ao salvar veículo.'); }
});

async function excluirVeiculo(id) {
    if (!confirm('Tem certeza? A exclusão não pode ser desfeita.')) return;
    try {
        const { error } = await supabaseClient.from('veiculos').delete().eq('id', id);
        if (error) throw error;
        carregarListaVeiculos();
        carregarVeiculosDropdown();
    } catch (error) { console.error('Erro ao excluir veículo:', error); alert('Falha ao excluir. O veículo pode estar associado a um registro de abastecimento.'); }
}

// --- 5. LÓGICA DA ABA DE ABASTECIMENTO ---
const abastecimentoMain = document.getElementById('abastecimento-main');

function buildAbastecimentoLayout() {
    abastecimentoMain.innerHTML = `
        <div class="card">
            <h2>1. Carregar Saldo na Máquina (Entrada)</h2>
            <form id="form-entrada">
                <div class="form-row">
                    <div class="form-group" style="flex:1;">
                        <label for="veiculo-select">Máquina a ser Carregada</label>
                        <select id="veiculo-select" required><option value="">-- Carregando --</option></select>
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label for="litros-adicionar">Litros a Adicionar</label>
                        <input type="number" id="litros-adicionar" step="0.01" required>
                    </div>
                </div>
                <button type="submit" class="btn">Adicionar Saldo</button>
            </form>
        </div>
        <div class="card">
            <h2>2. Registrar Abastecimento no Campo (Saída)</h2>
            <form id="form-saida">
                 <div class="form-row">
                    <div class="form-group" style="flex: 2;">
                        <label>Leitura do Hidrômetro da Bomba</label>
                        <div class="form-row" style="margin-bottom: 0; display:flex; gap: 1.5rem;">
                            <input type="number" id="leitura-inicial" placeholder="Leitura Inicial" step="0.01" required>
                            <input type="number" id="leitura-final" placeholder="Leitura Final" step="0.01" required>
                        </div>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Total Abastecido</label>
                        <div class="total-display"><span id="total-abastecido">0 L</span></div>
                    </div>
                </div>
                <div class="form-row" style="display:flex; gap: 1.5rem;">
                    <div class="form-group" style="flex:1;"><label for="horimetro">Horímetro / Odômetro</label><input type="text" id="horimetro"></div>
                    <div class="form-group" style="flex:1;"><label for="operador">Operador</label><input type="text" id="operador"></div>
                </div>
                <div class="form-group"><label for="observacao">Observação</label><textarea id="observacao"></textarea></div>
                <button type="submit" id="btn-registrar-saida" class="btn" disabled>Registrar Abastecimento</button>
            </form>
        </div>
        <div class="card">
            <h2>Histórico de Operações Recentes</h2>
            <div id="historico-container"></div>
        </div>
    `;
}

async function carregarVeiculosDropdown() {
    const veiculoSelect = document.getElementById('veiculo-select');
    if (!veiculoSelect) return;
    try {
        const { data, error } = await supabaseClient.from('veiculos').select('id, nome').order('nome');
        if (error) throw error;
        veiculoSelect.innerHTML = '<option value="">-- Selecione --</option>';
        data.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = v.nome;
            veiculoSelect.appendChild(option);
        });
    } catch (error) { console.error('Erro ao carregar dropdown:', error); }
}

async function carregarHistorico() {
    const historicoContainer = document.getElementById('historico-container');
    if (!historicoContainer) return;
    historicoContainer.innerHTML = '<p>Carregando histórico...</p>';
    try {
        const { data, error } = await supabaseClient.from('abastecimentos').select(`*, veiculos ( nome )`).order('created_at', { ascending: false }).limit(5);
        if (error) throw error;
        historicoContainer.innerHTML = data.length === 0 ? '<p>Nenhum registro encontrado.</p>' : '';
        data.forEach(reg => {
            const item = document.createElement('div');
            item.className = 'historico-item';
            const isEntrada = reg.tipo_operacao === 'entrada';
            const litros = isEntrada ? reg.litros_alocados : reg.litros_abastecidos;
            const nomeVeiculo = reg.veiculos ? reg.veiculos.nome : 'Veículo não encontrado';
            item.innerHTML = `
                <div class="historico-info">
                    <div class="historico-icon ${isEntrada ? 'icon-entrada' : 'icon-saida'}"><span>${isEntrada ? 'E' : 'S'}</span></div>
                    <div>
                        <strong>${nomeVeiculo}</strong>
                        <span class="meta-info">${isEntrada ? 'Carga de Saldo' : 'Abastecimento em Campo'} • ${new Date(reg.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
                <div class="historico-litros ${isEntrada ? 'litros-entrada' : 'litros-saida'}">
                    ${isEntrada ? '+' : '-'} ${litros} L
                </div>`;
            historicoContainer.appendChild(item);
        });
    } catch (error) { console.error('Erro ao carregar histórico:', error); }
}

async function atualizarInfoMaquina(veiculoId) {
    const veiculoSelect = document.getElementById('veiculo-select');
    const nomeVeiculo = veiculoSelect.options[veiculoSelect.selectedIndex].textContent;
    if (!veiculoId) {
        infoMaquinaCard.innerHTML = `<h2>Informações da Máquina</h2><p>Selecione uma máquina para iniciar a operação.</p>`;
        return;
    }
    infoMaquinaCard.innerHTML = `<h2>${nomeVeiculo}</h2><p>Calculando saldo...</p>`;
    try {
        const { data, error } = await supabaseClient.from('abastecimentos').select('litros_alocados, litros_abastecidos, tipo_operacao').eq('veiculo_id', veiculoId);
        if (error) throw error;
        const totalEntradas = data.filter(r=>r.tipo_operacao==='entrada').reduce((s, r)=>s+(r.litros_alocados||0),0);
        const totalSaidas = data.filter(r=>r.tipo_operacao==='saida').reduce((s, r)=>s+(r.litros_abastecidos||0),0);
        const saldoAtual = totalEntradas - totalSaidas;
        infoMaquinaCard.innerHTML = `
            <h2>${nomeVeiculo}</h2>
            <div class="saldo-info">
                <p><span>Total Carregado:</span> <span>+ ${totalEntradas.toFixed(2)} L</span></p>
                <p><span>Total Abastecido:</span> <span>- ${totalSaidas.toFixed(2)} L</span></p>
                <p class="saldo-final"><span>Saldo Atual:</span> <span>${saldoAtual.toFixed(2)} L</span></p>
            </div>`;
    } catch (error) { console.error("Erro ao calcular saldo:", error); }
}

function calcularTotalAbastecido() {
    const inicial = parseFloat(document.getElementById('leitura-inicial').value) || 0;
    const final = parseFloat(document.getElementById('leitura-final').value) || 0;
    const totalDisplay = document.getElementById('total-abastecido');
    const btn = document.getElementById('btn-registrar-saida');
    if (final > inicial) {
        const total = final - inicial;
        totalDisplay.textContent = `${total.toFixed(2)} L`;
        btn.disabled = false;
    } else {
        totalDisplay.textContent = '0 L';
        btn.disabled = true;
    }
}

// --- INICIALIZAÇÃO E LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    buildAbastecimentoLayout();
    carregarVeiculosDropdown();
    carregarHistorico();
    showSection('section-abastecimento');
    
    sectionAbastecimento.addEventListener('change', (event) => {
        if (event.target.id === 'veiculo-select') {
            atualizarInfoMaquina(event.target.value);
        }
    });

    sectionAbastecimento.addEventListener('input', (event) => {
        if (event.target.id === 'leitura-inicial' || event.target.id === 'leitura-final') {
            calcularTotalAbastecido();
        }
    });

    sectionAbastecimento.addEventListener('submit', async (event) => {
        event.preventDefault();
        const veiculoId = document.getElementById('veiculo-select').value;
        
        if (event.target.id === 'form-entrada') {
            if (!veiculoId) { alert('Por favor, selecione um veículo.'); return; }
            const litros = document.getElementById('litros-adicionar').value;
            const novoRegistro = { veiculo_id: veiculoId, litros_alocados: litros, tipo_operacao: 'entrada' };
            try {
                const { error } = await supabaseClient.from('abastecimentos').insert([novoRegistro]);
                if (error) throw error;
                alert('Saldo adicionado com sucesso!');
                event.target.reset();
                carregarHistorico();
                atualizarInfoMaquina(veiculoId);
            } catch(e) { console.error(e); alert('Erro ao salvar saldo.');}
        } 
        
        if (event.target.id === 'form-saida') {
            if (!veiculoId) { alert('Por favor, selecione um veículo na Etapa 1.'); return; }
            const totalAbastecido = parseFloat(document.getElementById('total-abastecido').textContent) || 0;
            const novoRegistro = {
                veiculo_id: veiculoId,
                hidrometro_inicial: document.getElementById('leitura-inicial').value,
                hidrometro_final: document.getElementById('leitura-final').value,
                litros_abastecidos: totalAbastecido,
                horimetro_odometro: document.getElementById('horimetro').value,
                nome_operador: document.getElementById('operador').value,
                observacao: document.getElementById('observacao').value,
                tipo_operacao: 'saida',
            };
            try {
                const { error } = await supabaseClient.from('abastecimentos').insert([novoRegistro]);
                if (error) throw error;
                alert('Abastecimento registrado com sucesso!');
                event.target.reset();
                calcularTotalAbastecido();
                carregarHistorico();
                atualizarInfoMaquina(veiculoId);
            } catch(e) { console.error(e); alert('Erro ao registrar abastecimento.'); }
        }
    });
});