// --- 1. CONFIGURAÇÃO DO CLIENTE SUPABASE ---
const SUPABASE_URL = 'https://exrglbxgoizdksyllmse.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cmdsYnhnb2l6ZGtzeWxsbXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzM1MzgsImV4cCI6MjA3NzM0OTUzOH0.yZ7vry7e_cqlODwzbFkZZSPQSDWOI4nl10LJBPhudIA';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- SELETORES GLOBAIS ---
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const userEmailDisplay = document.getElementById('user-email-display');
const btnLogout = document.getElementById('btn-logout');
const navDashboard = document.getElementById('nav-dashboard');
const navAbastecimento = document.getElementById('nav-abastecimento');
const navVeiculos = document.getElementById('nav-veiculos');
const navHistorico = document.getElementById('nav-historico');
const infoMaquinaCard = document.getElementById('info-maquina');

// --- LÓGICA DE AUTENTICAÇÃO ---
async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        userEmailDisplay.textContent = session.user.email;
        initializeMainApp();
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = 'A entrar...';
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { errorEl.textContent = 'Email ou senha inválidos.'; } 
    else { errorEl.textContent = ''; checkUserSession(); }
});

btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.reload();
});

// --- LÓGICA DE NAVEGAÇÃO ---
function showSection(sectionId) {
    document.querySelectorAll('#app-container .section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
    const section = document.getElementById(sectionId);
    const navLink = document.getElementById(`nav-${sectionId.split('-')[1]}`);
    if (section) section.classList.add('active');
    if (navLink) navLink.classList.add('active');
    if (sectionId === 'section-dashboard') carregarDadosDashboard();
    else if (sectionId === 'section-abastecimento') { carregarVeiculosDropdown(); carregarHistorico(); atualizarInfoMaquina(); }
    else if (sectionId === 'section-veiculos') carregarListaVeiculos();
    else if (sectionId === 'section-historico') { popularFiltroVeiculos(); buscarHistoricoDetalhado(); }
}

// --- LÓGICA DO DASHBOARD ---
let barChartInstance, lineChartInstance;
async function carregarDadosDashboard() {
    const kpiTotalMesEl = document.getElementById('kpi-total-mes');
    const kpiTopVeiculoEl = document.getElementById('kpi-top-veiculo');
    const kpiTopVeiculoLitrosEl = document.getElementById('kpi-top-veiculo-litros');
    const kpiOpsHojeEl = document.getElementById('kpi-ops-hoje');
    kpiTotalMesEl.textContent = '...'; kpiTopVeiculoEl.textContent = '...'; kpiOpsHojeEl.textContent = '...'; kpiTopVeiculoLitrosEl.textContent = '';
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const { data: dadosMes, error: errorMes } = await supabaseClient.from('abastecimentos').select('litros_abastecidos, created_at, veiculos(nome)').eq('tipo_operacao', 'saida').gte('created_at', trintaDiasAtras.toISOString());
    if (errorMes) { console.error("Erro dashboard:", errorMes); return; }
    const totalConsumidoMes = dadosMes.reduce((acc, op) => acc + (op.litros_abastecidos || 0), 0);
    kpiTotalMesEl.textContent = `${totalConsumidoMes.toFixed(2)} L`;
    const consumoPorVeiculo = dadosMes.reduce((acc, op) => { const nome = op.veiculos?.nome || 'Desconhecido'; acc[nome] = (acc[nome] || 0) + (op.litros_abastecidos || 0); return acc; }, {});
    let topVeiculo = { nome: 'Nenhum', litros: 0 };
    for (const nome in consumoPorVeiculo) { if (consumoPorVeiculo[nome] > topVeiculo.litros) { topVeiculo = { nome, litros: consumoPorVeiculo[nome] }; } }
    kpiTopVeiculoEl.textContent = topVeiculo.nome;
    if (topVeiculo.litros > 0) { kpiTopVeiculoLitrosEl.textContent = `${topVeiculo.litros.toFixed(2)} L consumidos`; }
    const hoje = new Date().toISOString().slice(0, 10);
    const { count: opsHoje, error: errorHoje } = await supabaseClient.from('abastecimentos').select('*', { count: 'exact', head: true }).gte('created_at', hoje);
    kpiOpsHojeEl.textContent = errorHoje ? 'Erro' : opsHoje;
    renderizarGraficoBarras(consumoPorVeiculo);
    renderizarGraficoLinhas();
}
function renderizarGraficoBarras(dados) {
    const ctx = document.getElementById('barChart')?.getContext('2d');
    if (!ctx) return;
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(ctx, { type: 'bar', data: { labels: Object.keys(dados), datasets: [{ label: 'Litros Consumidos', data: Object.values(dados), backgroundColor: 'rgba(74, 105, 189, 0.7)' }] }, options: { scales: { y: { beginAtZero: true } } } });
}
async function renderizarGraficoLinhas() {
    const ctx = document.getElementById('lineChart')?.getContext('2d');
    if (!ctx) return;
    const seteDiasAtras = new Date(); seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const { data, error } = await supabaseClient.from('abastecimentos').select('created_at, litros_abastecidos').eq('tipo_operacao', 'saida').gte('created_at', seteDiasAtras.toISOString());
    if (error) { console.error("Erro gráfico linha:", error); return; }
    const consumoPorDia = {}; const labels = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); labels.push(dia); consumoPorDia[dia] = 0; }
    data.forEach(op => { const dia = new Date(op.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); if (consumoPorDia.hasOwnProperty(dia)) { consumoPorDia[dia] += op.litros_abastecidos || 0; } });
    if (lineChartInstance) lineChartInstance.destroy();
    lineChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Consumo Diário (L)', data: Object.values(consumoPorDia), fill: false, borderColor: 'rgb(32, 191, 107)', tension: 0.1 }] } });
}

// --- LÓGICA DE VEÍCULOS (CRUD) ---
const veiculoModal = document.getElementById('veiculo-modal');
const modalTitleVeiculo = document.getElementById('modal-title-veiculo');
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
        if (data.length === 0) { listaVeiculosBody.innerHTML = '<tr><td colspan="3">Nenhum veículo.</td></tr>'; return; }
        data.forEach(veiculo => {
            const tr = document.createElement('tr');
            const nomeEscapado = veiculo.nome.replace(/'/g, "\\'");
            const tipoEscapado = (veiculo.tipo || '').replace(/'/g, "\\'");
            tr.innerHTML = `<td>${veiculo.nome}</td><td>${veiculo.tipo || ''}</td><td class="actions"><button class="btn btn-sm" onclick="openModalForEdit(${veiculo.id},'${nomeEscapado}','${tipoEscapado}')">Editar</button><button class="btn btn-sm btn-danger" onclick="excluirVeiculo(${veiculo.id})">Excluir</button></td>`;
            listaVeiculosBody.appendChild(tr);
        });
    } catch (error) { console.error('Erro ao carregar veículos:', error); }
}
function openModalForCreate() { veiculoForm.reset(); veiculoIdInput.value = ''; modalTitleVeiculo.textContent = 'Adicionar Veículo'; veiculoModal.style.display = 'flex'; }
function openModalForEdit(id, nome, tipo) { veiculoForm.reset(); veiculoIdInput.value = id; veiculoNomeInput.value = nome; veiculoTipoInput.value = tipo; modalTitleVeiculo.textContent = 'Editar Veículo'; veiculoModal.style.display = 'flex'; }
function closeVeiculoModal() { veiculoModal.style.display = 'none'; }
async function excluirVeiculo(id) {
    if (!confirm('Tem certeza?')) return;
    try { const { error } = await supabaseClient.from('veiculos').delete().eq('id', id); if (error) throw error; carregarListaVeiculos(); carregarVeiculosDropdown(); } 
    catch (error) { console.error('Erro ao excluir:', error); alert('Falha ao excluir.'); }
}

// --- LÓGICA DO MODAL DE EDIÇÃO DE ABASTECIMENTO ---
const abastecimentoModal = document.getElementById('abastecimento-modal');
const abastecimentoForm = document.getElementById('abastecimento-form');
const abastecimentoIdInput = document.getElementById('abastecimento-id');
const abastecimentoVeiculoInput = document.getElementById('abastecimento-veiculo');
const abastecimentoLitrosInput = document.getElementById('abastecimento-litros');
const abastecimentoOperadorInput = document.getElementById('abastecimento-operador');
const abastecimentoHorimetroInput = document.getElementById('abastecimento-horimetro');
const abastecimentoObservacaoInput = document.getElementById('abastecimento-observacao');
function openAbastecimentoModal(reg) {
    abastecimentoForm.reset();
    abastecimentoIdInput.value = reg.id;
    abastecimentoVeiculoInput.value = reg.veiculos ? reg.veiculos.nome : 'Não encontrado';
    abastecimentoLitrosInput.value = reg.litros_abastecidos || reg.litros_alocados || '';
    abastecimentoOperadorInput.value = reg.nome_operador || '';
    abastecimentoHorimetroInput.value = reg.horimetro_odometro || '';
    abastecimentoObservacaoInput.value = reg.observacao || '';
    abastecimentoLitrosInput.disabled = reg.tipo_operacao === 'entrada';
    abastecimentoModal.style.display = 'flex';
}
function closeAbastecimentoModal() { abastecimentoModal.style.display = 'none'; }
abastecimentoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = abastecimentoIdInput.value;
    const isEntrada = abastecimentoLitrosInput.disabled;
    const dataToUpdate = {
        nome_operador: abastecimentoOperadorInput.value,
        horimetro_odometro: abastecimentoHorimetroInput.value,
        observacao: abastecimentoObservacaoInput.value,
    };
    if (!isEntrada) { dataToUpdate.litros_abastecidos = abastecimentoLitrosInput.value; }
    try {
        const { error } = await supabaseClient.from('abastecimentos').update(dataToUpdate).eq('id', id);
        if (error) throw error;
        closeAbastecimentoModal();
        buscarHistoricoDetalhado();
        alert('Registo atualizado!');
    } catch (error) { console.error('Erro ao atualizar:', error); alert('Falha ao atualizar.'); }
});

// --- LÓGICA DE ABASTECIMENTO ---
async function carregarVeiculosDropdown() {
    const veiculoSelect = document.getElementById('veiculo-select');
    if (!veiculoSelect) return;
    try {
        const { data, error } = await supabaseClient.from('veiculos').select('id, nome').order('nome');
        if (error) throw error;
        const currentValue = veiculoSelect.value;
        veiculoSelect.innerHTML = '<option value="">-- Selecione --</option>';
        data.forEach(v => { const option = document.createElement('option'); option.value = v.id; option.textContent = v.nome; veiculoSelect.appendChild(option); });
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
            const nomeVeiculo = reg.veiculos ? reg.veiculos.nome : 'Não encontrado';
            item.innerHTML = `<div class="historico-info"><div class="historico-icon ${isEntrada ? 'icon-entrada' : 'icon-saida'}"><span>${isEntrada ? 'E' : 'S'}</span></div><div><strong>${nomeVeiculo}</strong><span class="meta-info">${isEntrada ? 'Carga' : 'Abastecimento'} • ${new Date(reg.created_at).toLocaleDateString('pt-BR')}</span></div></div><div class="historico-litros ${isEntrada ? 'litros-entrada' : 'litros-saida'}">${isEntrada ? '+' : '-'} ${litros || 0} L</div>`;
            historicoContainer.appendChild(item);
        });
    } catch (error) { console.error('Erro ao carregar histórico:', error); }
}
async function atualizarInfoMaquina() {
    const veiculoSelect = document.getElementById('veiculo-select');
    if (!veiculoSelect) return;
    const veiculoId = veiculoSelect.value;
    const nomeVeiculo = veiculoSelect.options[veiculoSelect.selectedIndex]?.textContent;
    if (!veiculoId || !nomeVeiculo) { infoMaquinaCard.innerHTML = `<h2>Informações</h2><p>Selecione uma máquina.</p>`; return; }
    infoMaquinaCard.innerHTML = `<h2>${nomeVeiculo}</h2><p>Calculando...</p>`;
    try {
        const { data, error } = await supabaseClient.from('abastecimentos').select('litros_alocados, litros_abastecidos, tipo_operacao').eq('veiculo_id', veiculoId);
        if (error) throw error;
        const totalEntradas = data.filter(r=>r.tipo_operacao==='entrada').reduce((s, r)=>s+(r.litros_alocados||0),0);
        const totalSaidas = data.filter(r=>r.tipo_operacao==='saida').reduce((s, r)=>s+(r.litros_abastecidos||0),0);
        const saldoAtual = totalEntradas - totalSaidas;
        infoMaquinaCard.innerHTML = `<h2>${nomeVeiculo}</h2><div class="saldo-info"><p><span>Carregado:</span> <span>+ ${totalEntradas.toFixed(2)} L</span></p><p><span>Abastecido:</span> <span>- ${totalSaidas.toFixed(2)} L</span></p><p class="saldo-final"><span>Saldo Atual:</span> <span>${saldoAtual.toFixed(2)} L</span></p></div>`;
    } catch (error) { console.error("Erro ao calcular saldo:", error); }
}
function calcularTotalAbastecido() {
    const inicial = parseFloat(document.getElementById('leitura-inicial')?.value) || 0;
    const final = parseFloat(document.getElementById('leitura-final')?.value) || 0;
    const totalDisplay = document.getElementById('total-abastecido');
    const btn = document.getElementById('btn-registrar-saida');
    if (!totalDisplay || !btn) return;
    if (final > inicial) { const total = final - inicial; totalDisplay.textContent = `${total.toFixed(2)} L`; btn.disabled = false; } 
    else { totalDisplay.textContent = '0 L'; btn.disabled = true; }
}

// --- LÓGICA DO HISTÓRICO AVANÇADO ---
const btnBuscarHistorico = document.getElementById('btn-buscar-historico');
async function popularFiltroVeiculos() {
    const filtroVeiculoSelect = document.getElementById('filtro-veiculo');
    if (!filtroVeiculoSelect) return;
    try {
        const { data, error } = await supabaseClient.from('veiculos').select('id, nome').order('nome');
        if (error) throw error;
        filtroVeiculoSelect.innerHTML = '<option value="">Todos</option>';
        data.forEach(v => { const option = document.createElement('option'); option.value = v.id; option.textContent = v.nome; filtroVeiculoSelect.appendChild(option); });
    } catch (error) { console.error('Erro ao carregar filtro:', error); }
}
async function buscarHistoricoDetalhado() {
    const historicoDetalhadoBody = document.getElementById('historico-detalhado-body');
    if (!historicoDetalhadoBody) return;
    historicoDetalhadoBody.innerHTML = '<tr><td colspan="7">Buscando...</td></tr>';
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
        if (data.length === 0) { historicoDetalhadoBody.innerHTML = '<tr><td colspan="7">Nenhum resultado.</td></tr>'; return; }
        data.forEach(reg => {
            const tr = document.createElement('tr');
            const isEntrada = reg.tipo_operacao === 'entrada';
            const litros = isEntrada ? reg.litros_alocados : reg.litros_abastecidos;
            tr.innerHTML = `<td>${new Date(reg.created_at).toLocaleDateString('pt-BR')}</td><td>${reg.veiculos ? reg.veiculos.nome : 'N/A'}</td><td>${isEntrada ? 'Entrada' : 'Saída'}</td><td style="color:${isEntrada ? 'var(--green-total)' : 'var(--danger-color)'}">${isEntrada ? '+' : '-'} ${litros || 0} L</td><td>${reg.nome_operador || ''}</td><td>${reg.horimetro_odometro || ''}</td><td class="actions"><button class="btn btn-sm" onclick='openAbastecimentoModal(${JSON.stringify(reg)})'>Editar</button></td>`;
            historicoDetalhadoBody.appendChild(tr);
        });
    } catch (error) { console.error('Erro ao buscar histórico:', error); }
}

// --- INICIALIZAÇÃO E LISTENERS GLOBAIS ---
function initializeMainApp() {
    navDashboard.addEventListener('click', () => showSection('section-dashboard'));
    navAbastecimento.addEventListener('click', () => showSection('section-abastecimento'));
    navVeiculos.addEventListener('click', () => showSection('section-veiculos'));
    navHistorico.addEventListener('click', () => showSection('section-historico'));
    document.getElementById('btn-novo-veiculo').addEventListener('click', openModalForCreate);
    document.getElementById('close-veiculo-modal').addEventListener('click', closeVeiculoModal);
    window.addEventListener('click', (event) => { if (event.target == veiculoModal) closeVeiculoModal(); });
    veiculoForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = veiculoIdInput.value;
        const veiculoData = { nome: veiculoNomeInput.value, tipo: veiculoTipoInput.value };
        try {
            const { error } = id ? await supabaseClient.from('veiculos').update(veiculoData).eq('id', id) : await supabaseClient.from('veiculos').insert([veiculoData]);
            if (error) throw error; closeModal(); carregarListaVeiculos(); carregarVeiculosDropdown();
        } catch (error) { console.error('Erro ao salvar veículo:', error); }
    });
    btnBuscarHistorico.addEventListener('click', buscarHistoricoDetalhado);
    document.body.addEventListener('change', (event) => { if (event.target.id === 'veiculo-select') { atualizarInfoMaquina(); } });
    document.body.addEventListener('input', (event) => { if (event.target.id === 'leitura-inicial' || event.target.id === 'leitura-final') { calcularTotalAbastecido(); } });
    document.body.addEventListener('submit', async (event) => {
        if (event.target.matches('#form-entrada, #form-saida')) {
            event.preventDefault();
            const { data: { user } } = await supabaseClient.auth.getUser();
            const veiculoId = document.getElementById('veiculo-select').value;
            if (!veiculoId) { alert('Selecione um veículo.'); return; }
            if (event.target.id === 'form-entrada') {
                const litros = document.getElementById('litros-adicionar').value;
                const novoRegistro = { veiculo_id: veiculoId, litros_alocados: litros, tipo_operacao: 'entrada', user_id: user.id };
                try {
                    const { error } = await supabaseClient.from('abastecimentos').insert([novoRegistro]);
                    if (error) throw error; alert('Saldo adicionado!'); event.target.reset(); carregarHistorico(); atualizarInfoMaquina();
                } catch(e) { console.error(e); alert('Erro ao salvar.');}
            } 
            if (event.target.id === 'form-saida') {
                const totalAbastecido = parseFloat(document.getElementById('total-abastecido').textContent) || 0;
                const novoRegistro = { veiculo_id: veiculoId, hidrometro_inicial: document.getElementById('leitura-inicial').value, hidrometro_final: document.getElementById('leitura-final').value, litros_abastecidos: totalAbastecido, horimetro_odometro: document.getElementById('horimetro').value, nome_operador: document.getElementById('operador').value, observacao: document.getElementById('observacao').value, tipo_operacao: 'saida', user_id: user.id };
                try {
                    const { error } = await supabaseClient.from('abastecimentos').insert([novoRegistro]);
                    if (error) throw error; alert('Abastecimento registrado!'); event.target.reset(); calcularTotalAbastecido(); carregarHistorico(); atualizarInfoMaquina();
                } catch(e) { console.error(e); alert('Erro ao registrar.'); }
            }
        }
    });
    showSection('section-dashboard');
}

document.addEventListener('DOMContentLoaded', checkUserSession);