'use client';

import { useState, useRef, useEffect } from 'react';
import type { IndicacaoResponse, ExtractedData, IndicacaoCategoria } from '@/lib/types';

interface TemplateInfo {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
}

type UIState =
  | { phase: 'idle' }
  | { phase: 'loading'; message: string }
  | { phase: 'incomplete'; perguntas: string[]; extracted: ExtractedData }
  | { phase: 'success'; textoFinal: string; recordId: string; copied: boolean }
  | { phase: 'error'; message: string };

const CATEGORIA_LABELS: Record<IndicacaoCategoria, string> = {
  servico_urbano:    'Serviços Urbanos',
  seguranca_publica: 'Segurança Pública',
  saude:             'Saúde',
  educacao:          'Educação',
  cultura_lazer:     'Cultura e Lazer',
  meio_ambiente:     'Meio Ambiente',
  homenagem:         'Homenagem / Reconhecimento',
  outros:            'Outros',
};

const CATEGORIA_COLORS: Record<IndicacaoCategoria, string> = {
  servico_urbano:    'bg-orange-100 text-orange-800',
  seguranca_publica: 'bg-red-100 text-red-800',
  saude:             'bg-green-100 text-green-800',
  educacao:          'bg-blue-100 text-blue-800',
  cultura_lazer:     'bg-purple-100 text-purple-800',
  meio_ambiente:     'bg-emerald-100 text-emerald-800',
  homenagem:         'bg-yellow-100 text-yellow-800',
  outros:            'bg-gray-100 text-gray-700',
};

export default function HomePage() {
  const [texto, setTexto] = useState('');
  const [state, setState] = useState<UIState>({ phase: 'idle' });
  const [complementos, setComplementos] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(data => {
        const list: TemplateInfo[] = data.templates ?? [];
        setTemplates(list);
        const active = list.find(t => t.isActive);
        if (active) setSelectedTemplateId(active.id);
        else if (list[0]) setSelectedTemplateId(list[0].id);
      })
      .catch(() => {});
  }, []);

  async function handleGerar(textoInput: string, complementosInput?: Record<string, string>) {
    if (textoInput.trim().length < 10) return;

    setState({ phase: 'loading', message: 'Analisando texto e extraindo informações...' });

    try {
      const res = await fetch('/api/indicacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoInput, complementos: complementosInput, templateId: selectedTemplateId || undefined }),
      });

      const data: IndicacaoResponse = await res.json();

      if (data.status === 'incomplete') {
        setState({
          phase: 'incomplete',
          perguntas: data.perguntas_faltantes ?? [],
          extracted: data.extracted!,
        });
        return;
      }

      if (data.status === 'success') {
        setState({
          phase: 'success',
          textoFinal: data.texto_final!,
          recordId: data.record_id!,
          copied: false,
        });
        setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        return;
      }

      // Erro
      setState({ phase: 'error', message: data.error ?? 'Erro desconhecido.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha de conexão.';
      setState({ phase: 'error', message: msg });
    }
  }

  async function handleCompletar() {
    if (state.phase !== 'incomplete') return;
    setState({ phase: 'loading', message: 'Gerando indicação com informações complementadas...' });
    await handleGerar(texto, complementos);
  }

  async function handleCopiar() {
    if (state.phase !== 'success') return;
    await navigator.clipboard.writeText(state.textoFinal);
    setState({ ...state, copied: true });
    setTimeout(() => {
      if (state.phase === 'success') setState({ ...state, copied: false });
    }, 2000);
  }

  function handleNova() {
    setState({ phase: 'idle' });
    setTexto('');
    setComplementos({});
  }

  const isLoading = state.phase === 'loading';

  return (
    <div className="space-y-6">
      {/* Título da página */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gerar Indicação Legislativa</h1>
        <p className="text-gray-500 text-sm mt-1">
          Descreva o problema em texto livre. O sistema gera automaticamente o texto oficial e o PDF para protocolo.
        </p>
      </div>

      {/* Seletor de Template */}
      {templates.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-700 shrink-0">Template:</span>
            <div className="flex gap-2 flex-wrap flex-1">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    selectedTemplateId === t.id
                      ? 'bg-blue-800 text-white border-blue-800'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                  }`}
                >
                  {t.name}
                  {t.isActive && selectedTemplateId !== t.id && (
                    <span className="ml-1 text-xs text-gray-400">(padrão)</span>
                  )}
                </button>
              ))}
            </div>
            <a href="/editor.html" className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
              + Gerenciar templates
            </a>
          </div>
        </div>
      )}

      {/* Formulário de entrada */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Relato do pedido <span className="text-red-500">*</span>
          </label>
          <textarea
            className="textarea-base h-40 font-mono text-sm"
            placeholder={`Descreva em texto livre o que você quer indicar. Funciona para qualquer tema:\n\n• Serviços urbanos: "Rua das Flores nº 120, Jardim Três Marias — buraco no asfalto causando acidentes"\n• Cultura: "Solicitar que o forró seja reconhecido como patrimônio cultural de Guarujá"\n• Saúde: "Pedir ampliação do horário da UBS do Perequê"\n• Homenagem: "Propor nome de rua em homenagem ao professor João da Silva"`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={isLoading}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">Mínimo 10 caracteres</span>
            <span className="text-xs text-gray-400">{texto.length} caracteres</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            className="btn-primary"
            onClick={() => handleGerar(texto)}
            disabled={isLoading || texto.trim().length < 10}
          >
            {isLoading ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Processando...
              </>
            ) : (
              'Gerar Indicação'
            )}
          </button>
          {state.phase !== 'idle' && (
            <button className="btn-ghost" onClick={handleNova} disabled={isLoading}>
              Nova Indicação
            </button>
          )}
        </div>

        {/* Mensagem de carregamento */}
        {state.phase === 'loading' && (
          <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
            {state.message}
          </div>
        )}
      </div>

      {/* Perguntas faltantes */}
      {state.phase === 'incomplete' && (
        <div className="card p-5 space-y-4 border-amber-200 bg-amber-50">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-base font-semibold text-amber-800">Informações faltando</h2>
              {state.extracted.categoria && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORIA_COLORS[state.extracted.categoria] ?? 'bg-gray-100 text-gray-700'}`}>
                  {CATEGORIA_LABELS[state.extracted.categoria] ?? state.extracted.categoria}
                </span>
              )}
            </div>
            <p className="text-sm text-amber-700">
              Para gerar a indicação, precisamos das seguintes informações adicionais:
            </p>
          </div>
          <div className="space-y-3">
            {state.perguntas.map((pergunta, idx) => (
              <div key={idx}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {pergunta}
                </label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="Sua resposta..."
                  value={complementos[pergunta] ?? ''}
                  onChange={(e) =>
                    setComplementos((prev) => ({ ...prev, [pergunta]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <button
            className="btn-primary"
            onClick={handleCompletar}
            disabled={state.perguntas.some((p) => !complementos[p]?.trim())}
          >
            Completar e Gerar Indicação
          </button>
        </div>
      )}

      {/* Erro */}
      {state.phase === 'error' && (
        <div className="card p-5 border-red-200 bg-red-50">
          <h2 className="text-base font-semibold text-red-800 mb-1">Erro ao gerar indicação</h2>
          <p className="text-sm text-red-700 whitespace-pre-wrap">{state.message}</p>
        </div>
      )}

      {/* Prévia e ações */}
      {state.phase === 'success' && (
        <div ref={previewRef} className="space-y-4">
          {/* Barra de ações */}
          <div className="card p-4 flex flex-wrap gap-3 items-center justify-between">
            <span className="text-sm font-medium text-green-700 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
              Indicação gerada com sucesso
            </span>
            <div className="flex gap-2 flex-wrap">
              <button
                className="btn-secondary"
                onClick={handleCopiar}
              >
                {state.copied ? 'Copiado!' : 'Copiar Texto'}
              </button>
              <a
                href={`/api/pdf/${state.recordId}${selectedTemplateId ? `?templateId=${selectedTemplateId}` : ''}`}
                download
                className="btn-primary"
              >
                Baixar PDF
              </a>
              <a
                href={`/api/docx/${state.recordId}${selectedTemplateId ? `?templateId=${selectedTemplateId}` : ''}`}
                download
                className="btn-secondary"
              >
                Baixar Word
              </a>
            </div>
          </div>

          {/* Prévia do texto */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Prévia do texto — Indicação Legislativa
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-5">
              <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-gray-900">
                {state.textoFinal}
              </pre>
            </div>
          </div>

          {/* Ações secundárias */}
          <div className="flex gap-3">
            <button className="btn-ghost text-sm" onClick={handleNova}>
              Gerar Nova Indicação
            </button>
            <a href="/historico" className="btn-ghost text-sm">
              Ver Histórico
            </a>
          </div>
        </div>
      )}

      {/* Dicas de uso */}
      {state.phase === 'idle' && (
        <div className="card p-5 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Exemplos de indicações</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {EXEMPLOS.map((ex, i) => (
              <button
                key={i}
                onClick={() => setTexto(ex.texto)}
                className="text-left p-3 rounded-md border border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className={`text-xs px-2 py-0.5 rounded-full font-medium inline-block mb-1.5 ${CATEGORIA_COLORS[ex.categoria as IndicacaoCategoria] ?? 'bg-gray-100 text-gray-700'}`}>
                  {CATEGORIA_LABELS[ex.categoria as IndicacaoCategoria] ?? ex.categoria}
                </div>
                <div className="text-xs text-gray-600 line-clamp-3">{ex.texto}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const EXEMPLOS = [
  {
    categoria: 'servico_urbano',
    texto:
      'Na Rua das Palmeiras, número 340, bairro Jardim Três Marias, existe um buraco de aproximadamente 60cm de diâmetro e 20cm de profundidade no meio da pista. O local é de grande movimento e já causou queda de motociclistas. Solicito urgente operação tapa-buraco.',
  },
  {
    categoria: 'seguranca_publica',
    texto:
      'No bairro Santa Cruz dos Navegantes, a Rua Leopoldo Figueiredo está completamente escura à noite — cinco postes apagados há mais de duas semanas. O trecho favorece assaltos e acidentes. Solicito verificação e manutenção urgente da iluminação pública.',
  },
  {
    categoria: 'cultura_lazer',
    texto:
      'Solicito indicação para que o forró e o carnaval de rua de Guarujá sejam reconhecidos como patrimônio cultural imaterial do município, considerando a tradição histórica dessas manifestações na cidade.',
  },
  {
    categoria: 'saude',
    texto:
      'Solicito ampliação do horário de atendimento da UBS do bairro Perequê para incluir atendimento noturno até as 22h, considerando o grande número de trabalhadores que não conseguem se consultar durante o dia.',
  },
  {
    categoria: 'educacao',
    texto:
      'Solicito ao setor competente a criação de cursos profissionalizantes gratuitos de informática e empreendedorismo para jovens de 16 a 24 anos, a serem realizados nas escolas municipais do bairro Vicente de Carvalho.',
  },
  {
    categoria: 'homenagem',
    texto:
      'Proponho que uma das ruas do novo loteamento do bairro Jardim Três Marias receba o nome de "Professor Antônio Carlos Ferreira", em homenagem ao educador que dedicou 40 anos ao ensino público de Guarujá.',
  },
];
