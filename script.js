// --- 1. CONFIGURAÇÃO DO CLIENTE SUPABASE ---
const SUPABASE_URL = 'https://exrglbxgoizdksyllmse.supabase.co'; // <-- COLE SUA URL AQUI
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cmdsYnhnb2l6ZGtzeWxsbXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzM1MzgsImV4cCI6MjA3NzM0OTUzOH0.yZ7vry7e_cqlODwzbFkZZSPQSDWOI4nl10LJBPhudIA'; // <-- COLE SUA CHAVE ANON AQUI

// Inicialização correta do cliente para evitar erros de referência.
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. SELETORES DE ELEMENTOS DO DOM ---
const formAbastecimento = document.getElementById('form-abastecimento');
const listaRegistros = document.getElementById('lista-registros');

// --- 3. FUNÇÕES PRINCIPAIS ---

/**
 * Busca e exibe todos os registros da tabela 'abastecimentos'.
 */
async function listarRegistros() {
    try {
        // CORRIGIDO: Usando a nova variável 'supabaseClient'
        const { data: abastecimentos, error } = await supabaseClient
            .from('abastecimentos')
            .select('*')
            .order('data_abastecimento', { ascending: false });

        if (error) throw error;

        listaRegistros.innerHTML = ''; // Limpa a lista
        if (abastecimentos.length === 0) {
            listaRegistros.innerHTML = '<p>Nenhum registro encontrado.</p>';
            return;
        }

        abastecimentos.forEach(registro => {
            const divRegistro = document.createElement('div');
            divRegistro.classList.add('registro-item');
            const dataFormatada = new Date(registro.data_abastecimento + 'T00:00:00').toLocaleDateString('pt-BR');

            divRegistro.innerHTML = `
                <div>
                    <p class="maquina">${registro.nome_maquina}</p>
                    <p>${registro.litros_abastecidos} litros em ${dataFormatada}</p>
                </div>`;
            listaRegistros.appendChild(divRegistro);
        });
    } catch (error) {
        console.error('Erro ao listar registros:', error.message);
        listaRegistros.innerHTML = '<p style="color: red;">Não foi possível carregar os registros.</p>';
    }
}

/**
 * Insere um novo registro de abastecimento no banco de dados.
 */
async function adicionarRegistro(dadosRegistro) {
    try {
        // CORRIGIDO: Usando a nova variável 'supabaseClient'
        const { error } = await supabaseClient.from('abastecimentos').insert([dadosRegistro]);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Erro ao adicionar registro:', error.message);
        alert('Falha ao salvar o registro.');
        return false;
    }
}

// --- 4. EVENT LISTENERS ---
formAbastecimento.addEventListener('submit', async (event) => {
    event.preventDefault();
    const novoRegistro = {
        nome_maquina: formAbastecimento.nome_maquina.value,
        litros_abastecidos: formAbastecimento.litros_abastecidos.value,
        data_abastecimento: formAbastecimento.data_abastecimento.value
    };
    const sucesso = await adicionarRegistro(novoRegistro);
    if (sucesso) {
        formAbastecimento.reset();
        await listarRegistros();
    }
});

// --- 5. INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    listarRegistros();
});