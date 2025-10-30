// --- 1. CONFIGURAÇÃO DO CLIENTE SUPABASE ---
const SUPABASE_URL = 'https://exrglbxgoizdksyllmse.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cmdsYnhnb2l6ZGtzeWxsbXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzM1MzgsImV4cCI6MjA3NzM0OTUzOH0.yZ7vry7e_cqlODwzbFkZZSPQSDWOI4nl10LJBPhudIA';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. SELETORES GLOBAIS ---
const navAbastecimento = document.getElementById('nav-abastecimento');
const navVeiculos = document.getElementById('nav-veiculos');
const navHistorico = document.getElementById('nav-historico');
const infoMaquinaCard = document.getElementById('info-maquina');

// --- 3. LÓGICA DE NAVEGAÇÃO ENTRE ABAS (ROBUSTA) ---
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    document.getElementById(`nav-${sectionId.split('-')[1]}`).classList.add('active');

    if (sectionId === 'section-abastecimento') {
        carregarVeiculosDropdown();
        carregarHistorico();
        atualizarInfoMaquina();
    } else if (sectionId === 'section-veiculos') {
        carregarListaVeiculos();
    } else if (sectionId === 'section-historico') {
        popularFiltroVeiculos();
        buscarHistoricoDetalhado();
    }
}

navAbastecimento.addEventListener('click', () => showSection('section-abastecimento'));
navVeiculos.addEventListener('click', () => showSection('section-veiculos'));
navHistorico.addEventListener('click', () => showSection('section-historico'));

// --- 4. LÓGICA DE GERENCIAMENTO DE VEÍCULOS (CRUD) ---
const modal = document.getElementById('veiculo-modal');
const modalTitle = document.getElementById('modal-title');
const veiculoForm = document.getElementById('veiculo-form');
const veiculoIdInput = document.getElementById('veiculo-id');
const veiculoNomeInput = document.getElementById('veiculo-nome');
const veiculoTipoInput = document.getElementById('veiculo-tipo');

async function carregarListaVeiculos() {
    const listaVeiculosBody = document.getElementById('lista-veiculos');
    if (!listaVeiculosBody) return;
    listaVeiculosBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    try {
        const { data, error } = await supabaseClient.from('veiculos').select('*').order('nome');
        if (error) throw error;
        listaVeiculosBody.innerHTML = '';
        if (data.length === 0) { listaVeiculosBody.innerHTML = '<tr><td colspan="3">Nenhum veículo cadastrado.</td></tr>'; return; }
        data.forEach(veiculo => {
            const tr = document.createElement('tr');
            const nomeEscapado = veiculo.nome.replace(/'/g, "\\'");
            const tipoEscapado = (veiculo.tipo || '').replace(/'/g, "\\'");
            tr.innerHTML = `
                <td>${veiculo.nome}</td>
                <td>${veiculo.tipo || ''}</td>
                <td class="actions">
                    <button class="btn btn-sm" onclick="openModalForEdit(${veiculo.id},'${nomeEscapado}','${tipoEscapado}')">Editar</button>
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
    if (!confirm('Tem certeza?')) return;
    try {
        const { error } = await supabaseClient.from('veiculos').delete().eq('id', id);
        if (error) throw error;
        carregarListaVeiculos();
        carregarVeiculosDropdown();
    } catch (error) { console.error('Erro ao excluir veículo:', error); alert('Falha ao excluir.'); }
}

// --- 5. LÓGICA DA ABA DE ABASTECIMENTO ---
async function carregarVeiculosDropdown() {
    const veiculoSelect = document.getElementById('veiculo-select');
    if (!veiculoSelect) return;
    try {
        const { data, error } = await supabaseClient.from('veiculos').select('id, nome').order('nome');
        if (error) throw error;
        const currentValue = veiculoSelect.value;
        veiculoSelect.innerHTML = '<option value="">-- Selecione --</option>';
        data.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = v.nome;
            veiculoSelect.appendChild(option);
        });
        veiculoSelect.value = currentValue;
    } catch (error) { console.error('Erro ao carregar dropdown:', error); }
}

async function carregarHistorico() {
    const historicoContainer = document.getElementById('historico-container');
    if (!historicoContainer) return;
    historicoContainer.innerHTML = '<p>Carregando...</p>';
    try {
        const { data, error } = await supabaseClient.from('abastecimentos').select(`*, veiculos ( nome )`).order('created_at', { ascending: false }).limit(5);
        if (error) throw error;
        historicoContainer.innerHTML = data.length === 0 ? '<p>Nenhum registro.</p>' : '';
        data.forEach(reg => {
            const item = document.createElement('div'); item.className = 'historico-item';
            const isEntrada = reg.tipo_operacao === 'entrada';
            const litros = isEntrada ? reg.litros_alocados : reg.litros_abastecidos;
            const nomeVeiculo = reg.veiculos ? reg.veiculos.nome : 'Veículo não encontrado';
            item.innerHTML = `
                <div class="historico-info"><div class="historico-icon ${isEntrada ? 'icon-entrada' : 'icon-saida'}"><span>${isEntrada ? 'E' : 'S'}</span></div><div><strong>${nomeVeiculo}</strong><span class="meta-info">${isEntrada ? 'Carga' : 'Abastecimento'} • ${new Date(reg.created_at).toLocaleDateString('pt-BR')}</span></div></div>
                <div class="historico-litros ${isEntrada ? 'litros-entrada' : 'litros-saida'}">${isEntrada ? '+' : '-'} ${litros || 0} L</div>`;
            historicoContainer.appendChild(item);
        });
    } catch (error) { console.error('Erro ao carregar histórico:', error); }
}

async function atualizarInfoMaquina() {
    const veiculoSelect = document.getElementById('veiculo-select');
    if (!veiculoSelect) return;
    const veiculoId = veiculoSelect.value;
    const nomeVeiculo = veiculoSelect.options[veiculoSelect.selectedIndex]?.textContent;
    if (!veiculoId || !nomeVeiculo) {
        infoMaquinaCard.innerHTML = `<h2>Informações</h2><p>Selecione uma máquina.</p>`;
        return;
    }
    infoMaquinaCard.innerHTML = `<h2>${nomeVeiculo}</h2><p>Calculando...</p>`;
    try {
        const { data, error } = await supabaseClient.from('abastecimentos').select('litros_alocados, litros_abastecidos, tipo_operacao').eq('veiculo_id', veiculoId);
        if (error) throw error;
        const totalEntradas = data.filter(r=>r.tipo_operacao==='entrada').reduce((s, r)=>s+(r.litros_alocados||0),0);
        const totalSaidas = data.filter(r=>r.tipo_operacao==='saida').reduce((s, r)=>s+(r.litros_abastecidos||0),0);
        const saldoAtual = totalEntradas - totalSaidas;
        infoMaquinaCard.innerHTML = `
            <h2>${nomeVeiculo}</h2>
            <div class="saldo-info"><p><span>Carregado:</span> <span>+ ${totalEntradas.toFixed(2)} L</span></p><p><span>Abastecido:</span> <span>- ${totalSaidas.toFixed(2)} L</span></p><p class="saldo-final"><span>Saldo Atual:</span> <span>${saldoAtual.toFixed(2)} L</span></p></div>`;
    } catch (error) { console.error("Erro ao calcular saldo:", error); }
}

function calcularTotalAbastecido() {
    const inicial = parseFloat(document.getElementById('leitura-inicial')?.value) || 0;
    const final = parseFloat(document.getElementById('leitura-final')?.value) || 0;
    const totalDisplay = document.getElementById('total-abastecido');
    const btn = document.getElementById('btn-registrar-saida');
    if (!totalDisplay || !btn) return;
    if (final > inicial) {
        const total = final - inicial;
        totalDisplay.textContent = `${total.toFixed(2)} L`;
        btn.disabled = false;
    } else {
        totalDisplay.textContent = '0 L';
        btn.disabled = true;
    }
}

// --- 6. LÓGICA DO HISTÓRICO AVANÇADO ---
const btnBuscarHistorico = document.getElementById('btn-buscar-historico');

async function popularFiltroVeiculos() {
    const filtroVeiculoSelect = document.getElementById('filtro-veiculo');
    if (!filtroVeiculoSelect) return;
    try {
        const { data, error } = await supabaseClient.from('veiculos').select('id, nome').order('nome');
        if (error) throw error;
        filtroVeiculoSelect.innerHTML = '<option value="">Todos os Veículos</option>';
        data.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = v.nome;
            filtroVeiculoSelect.appendChild(option);
        });
    } catch (error) { console.error('Erro ao carregar filtro de veículos:', error); }
}

async function buscarHistoricoDetalhado() {
    const historicoDetalhadoBody = document.getElementById('historico-detalhado-body');
    if (!historicoDetalhadoBody) return;
    historicoDetalhadoBody.innerHTML = '<tr><td colspan="6">Buscando...</td></tr>';
    try {
        let query = supabaseClient.from('abastecimentos').select('*, veiculos ( nome )').order('created_at', { ascending: false });
        
        const veiculoId = document.getElementById('filtro-veiculo').value;
        if (veiculoId) { query = query.eq('veiculo_id', veiculoId); }
        const dataInicio = document.getElementById('filtro-data-inicio').value;
        if (dataInicio) { query = query.gte('created_at', dataInicio); }
        const dataFim = document.getElementById('filtro-data-fim').value;
        if (dataFim) { const d = new Date(dataFim); d.setDate(d.getDate() + 1); query = query.lte('created_at', d.toISOString().split('T')[0]); }

        const { data, error } = await query;
        if (error) throw error;

        historicoDetalhadoBody.innerHTML = '';
        if (data.length === 0) { historicoDetalhadoBody.innerHTML = '<tr><td colspan="6">Nenhum resultado.</td></tr>'; return; }

        data.forEach(reg => {
            const tr = document.createElement('tr');
            const isEntrada = reg.tipo_operacao === 'entrada';
            const litros = isEntrada ? reg.litros_alocados : reg.litros_abastecidos;
            tr.innerHTML = `
                <td>${new Date(reg.created_at).toLocaleDateString('pt-BR')}</td>
                <td>${reg.veiculos ? reg.veiculos.nome : 'N/A'}</td>
                <td>${isEntrada ? 'Entrada de Saldo' : 'Abastecimento'}</td>
                <td style="color:${isEntrada ? 'var(--green-total)' : 'var(--danger-color)'}">${isEntrada ? '+' : '-'} ${litros || 0} L</td>
                <td>${reg.nome_operador || ''}</td>
                <td>${reg.horimetro_odometro || ''}</td>`;
            historicoDetalhadoBody.appendChild(tr);
        });
    } catch (error) { console.error('Erro ao buscar histórico detalhado:', error); }
}

if (btnBuscarHistorico) btnBuscarHistorico.addEventListener('click', buscarHistoricoDetalhado);

// --- 7. INICIALIZAÇÃO E LISTENERS GLOBAIS ---
document.addEventListener('DOMContentLoaded', () => {
    showSection('section-abastecimento');
    
    document.body.addEventListener('change', (event) => {
        if (event.target.id === 'veiculo-select') {
            atualizarInfoMaquina();
        }
    });

    document.body.addEventListener('input', (event) => {
        if (event.target.id === 'leitura-inicial' || event.target.id === 'leitura-final') {
            calcularTotalAbastecido();
        }
    });

    document.body.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        if (event.target.matches('#form-entrada, #form-saida')) {
            const veiculoId = document.getElementById('veiculo-select').value;
            if (!veiculoId) { alert('Selecione um veículo.'); return; }

            if (event.target.id === 'form-entrada') {
                const litros = document.getElementById('litros-adicionar').value;
                const novoRegistro = { veiculo_id: veiculoId, litros_alocados: litros, tipo_operacao: 'entrada', nome_operador: 'Admin' };
                try {
                    const { error } = await supabaseClient.from('abastecimentos').insert([novoRegistro]);
                    if (error) throw error;
                    alert('Saldo adicionado!');
                    event.target.reset();
                    carregarHistorico();
                    atualizarInfoMaquina();
                } catch(e) { console.error(e); alert('Erro ao salvar.');}
            } 
            
            if (event.target.id === 'form-saida') {
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
                    alert('Abastecimento registrado!');
                    event.target.reset();
                    calcularTotalAbastecido();
                    carregarHistorico();
                    atualizarInfoMaquina();
                } catch(e) { console.error(e); alert('Erro ao registrar.'); }
            }
        }
    });
});