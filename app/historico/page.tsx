'use client';

import { useEffect, useState } from 'react';

interface HistoricoItem {
  id: string;
  createdAt: string;
  tipoServico: string;
  bairro: string;
  logradouro: string;
  numero: string | null;
  cep: string | null;
  textoFinal: string;
}

const TIPO_LABELS: Record<string, string> = {
  tapa_buraco: 'Tapa-Buraco',
  capinacao_rocada: 'Capinação / Roçada',
  iluminacao_publica: 'Iluminação Pública',
  drenagem_galerias: 'Drenagem / Galerias',
  limpeza_canal_desassoreamento: 'Limpeza de Canal',
  redutor_velocidade: 'Redutor de Velocidade',
  retirada_lixo_entulho: 'Retirada de Lixo',
  fiscalizacao_transito: 'Fiscalização de Trânsito',
  vulnerabilidade_social: 'Vulnerabilidade Social',
  estudo_tecnico: 'Estudo Técnico',
  outro: 'Outro',
};

const TIPO_COLORS: Record<string, string> = {
  tapa_buraco: 'bg-orange-100 text-orange-700',
  capinacao_rocada: 'bg-green-100 text-green-700',
  iluminacao_publica: 'bg-yellow-100 text-yellow-700',
  drenagem_galerias: 'bg-blue-100 text-blue-700',
  limpeza_canal_desassoreamento: 'bg-teal-100 text-teal-700',
  redutor_velocidade: 'bg-purple-100 text-purple-700',
  retirada_lixo_entulho: 'bg-red-100 text-red-700',
  fiscalizacao_transito: 'bg-indigo-100 text-indigo-700',
  vulnerabilidade_social: 'bg-pink-100 text-pink-700',
  estudo_tecnico: 'bg-gray-100 text-gray-700',
  outro: 'bg-gray-100 text-gray-600',
};

function formatData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoricoPage() {
  const [items, setItems] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/historico')
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError('Falha ao carregar histórico.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-500">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Indicações</h1>
          <p className="text-gray-500 text-sm mt-1">
            Últimas {items.length} indicações geradas
          </p>
        </div>
        <a href="/" className="btn-primary text-sm">
          Nova Indicação
        </a>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      {items.length === 0 && !error && (
        <div className="card p-10 text-center">
          <p className="text-gray-400 text-sm">Nenhuma indicação gerada ainda.</p>
          <a href="/" className="btn-primary text-sm mt-4 inline-flex">
            Gerar primeira indicação
          </a>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="card overflow-hidden">
            {/* Linha principal */}
            <div className="p-4 flex flex-wrap items-start gap-3">
              {/* Badge tipo */}
              <span
                className={`badge mt-0.5 flex-shrink-0 ${
                  TIPO_COLORS[item.tipoServico] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {TIPO_LABELS[item.tipoServico] ?? item.tipoServico}
              </span>

              {/* Endereço e data */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {item.logradouro}
                  {item.numero ? `, ${item.numero}` : ''} — {item.bairro}
                  {item.cep ? ` (CEP ${item.cep})` : ''}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{formatData(item.createdAt)}</div>
              </div>

              {/* Ações */}
              <div className="flex gap-2 flex-shrink-0 flex-wrap">
                <button
                  className="btn-ghost text-xs px-3 py-1.5"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  {expandedId === item.id ? 'Ocultar' : 'Ver texto'}
                </button>
                <a
                  href={`/api/pdf/${item.id}`}
                  download
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  PDF
                </a>
                <a
                  href={`/api/docx/${item.id}`}
                  download
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Word
                </a>
              </div>
            </div>

            {/* Texto expandido */}
            {expandedId === item.id && (
              <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                <pre className="whitespace-pre-wrap font-serif text-xs leading-relaxed text-gray-800">
                  {item.textoFinal}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
