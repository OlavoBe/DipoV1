'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, Building2, FileText, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface Step1Data {
  nomeVereador: string;
  nomePartido: string;
  nomeAssessor: string;
  municipio: string;
}

// ─────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────

const STEPS = [
  { num: 1, label: 'Seu gabinete',  icon: Building2 },
  { num: 2, label: 'Template',      icon: FileText   },
  { num: 3, label: 'Experimente',   icon: Zap        },
] as const;

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map(({ num, label }, idx) => {
        const done    = num < current;
        const active  = num === current;

        return (
          <div key={num} className="flex items-center">
            {/* Connector line */}
            {idx > 0 && (
              <div
                className={cn(
                  'w-16 h-0.5 mx-1 transition-colors',
                  done ? 'bg-blue-500' : 'bg-gray-200',
                )}
              />
            )}

            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all',
                  done   ? 'bg-blue-600 border-blue-600 text-white'         :
                  active ? 'bg-white border-blue-600 text-blue-700 shadow-sm' :
                           'bg-white border-gray-200 text-gray-400',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : num}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium whitespace-nowrap',
                  active ? 'text-blue-700' : done ? 'text-blue-500' : 'text-gray-400',
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Template Preview (passo 2)
// ─────────────────────────────────────────────

function TemplatePreview() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 font-serif text-[13px] leading-relaxed text-gray-800 select-none pointer-events-none">
      {/* Cabeçalho */}
      <div className="border-b-2 border-gray-800 pb-3 mb-4 text-center">
        <p className="font-bold uppercase text-sm tracking-wide">Câmara Municipal</p>
        <p className="text-xs uppercase tracking-wider text-gray-500">Estado de São Paulo</p>
        <p className="mt-1 text-[13px]">Gabinete do Vereador</p>
      </div>

      {/* Número */}
      <p className="font-semibold text-center mb-4">INDICAÇÃO Nº ___/2025</p>

      {/* Vocativo */}
      <p className="mb-3">Senhor Presidente,</p>

      {/* Corpo */}
      <p className="text-justify mb-3 indent-6">
        O Vereador abaixo assinado, no uso de suas atribuições legais e regimentais,
        indica ao Excelentíssimo Senhor Prefeito Municipal que determine ao setor
        competente a adoção das providências necessárias para atendimento ao
        pleito da comunidade.
      </p>

      <p className="text-justify mb-4 indent-6">
        A presente indicação visa suprir demanda legítima dos munícipes,
        contribuindo para a melhoria da qualidade de vida da população local.
      </p>

      {/* Local e data */}
      <p className="mb-6">Guarujá, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.</p>

      {/* Assinatura */}
      <div className="text-center mt-6 pt-4 border-t border-gray-400 w-56 mx-auto">
        <p className="font-bold uppercase text-xs tracking-wide">Vereador</p>
        <p className="text-xs text-gray-500">Câmara Municipal</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// OnboardingClient — componente principal
// ─────────────────────────────────────────────

interface Props {
  prefill: {
    nomeVereador: string;
    nomePartido: string;
    municipio: string;
    nomeAssessor: string;
  } | null;
}

export default function OnboardingClient({ prefill }: Props) {
  const router = useRouter();

  const [step, setStep]       = useState<Step>(1);
  const [saving, setSaving]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [textoDemo, setTextoDemo]   = useState('');

  // ── Formulário passo 1 ───────────────────────
  const [form, setForm] = useState<Step1Data>({
    nomeVereador: prefill?.nomeVereador ?? '',
    nomePartido:  prefill?.nomePartido  ?? '',
    nomeAssessor: prefill?.nomeAssessor ?? '',
    municipio:    prefill?.municipio    ?? 'Guarujá',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof Step1Data, string>>>({});

  function setField(field: keyof Step1Data, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  // ── Passo 1: validar e salvar ────────────────
  async function handleStep1() {
    const newErrors: typeof errors = {};
    if (!form.nomeVereador.trim()) newErrors.nomeVereador = 'Campo obrigatório';
    if (!form.nomeAssessor.trim()) newErrors.nomeAssessor = 'Campo obrigatório';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/tenant/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeVereador: form.nomeVereador.trim(),
          nomePartido:  form.nomePartido.trim(),
          municipio:    form.municipio.trim() || 'Guarujá',
          nomeAssessor: form.nomeAssessor.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErrors({ nomeVereador: data.error });
        return;
      }
      setStep(2);
    } finally {
      setSaving(false);
    }
  }

  // ── Passo 2: usa template padrão ─────────────
  function handleStep2() {
    setStep(3);
  }

  // ── Passo 3: marcar completo e redirecionar ──
  async function completeOnboarding() {
    await fetch('/api/tenant/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complete: true }),
    });
    router.push('/gerar');
    router.refresh(); // invalida cache da sessão
  }

  // ── Passo 3: gerar indicação de exemplo ──────
  async function handleGerar() {
    if (textoDemo.trim().length < 10) return;
    setGenerating(true);
    try {
      // Gera a indicação (já salva no banco via /api/indicacao)
      const res = await fetch('/api/indicacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoDemo.trim() }),
      });
      // Independente do resultado: marca completo e redireciona
      // (a geração pode ser incompleta — tudo bem, o usuário verá no painel)
      await completeOnboarding();
    } catch {
      // Mesmo em caso de erro na geração, finalizamos o onboarding
      await completeOnboarding();
    } finally {
      setGenerating(false);
    }
  }

  // ── Render ────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-bold text-blue-700 text-xl">Dipo</span>
          <span className="text-xs text-gray-400">Configuração inicial</span>
        </div>
      </header>

      {/* Wizard */}
      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-2">

          {/* Stepper */}
          <Stepper current={step} />

          {/* Card do passo atual */}
          <div className="card p-7 space-y-6">

            {/* ══ PASSO 1 ══════════════════════════════ */}
            {step === 1 && (
              <>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Configure seu gabinete</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Estas informações aparecem no cabeçalho das suas indicações.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Nome do Vereador */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Nome do Vereador <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={cn('input-base', errors.nomeVereador && 'border-red-400 focus:ring-red-400')}
                      placeholder="Ex: João da Silva"
                      value={form.nomeVereador}
                      onChange={(e) => setField('nomeVereador', e.target.value)}
                    />
                    {errors.nomeVereador && (
                      <p className="text-xs text-red-500 mt-1">{errors.nomeVereador}</p>
                    )}
                  </div>

                  {/* Nome do Partido */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Partido{' '}
                      <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      className="input-base"
                      placeholder="Ex: MDB, PT, PL…"
                      value={form.nomePartido}
                      onChange={(e) => setField('nomePartido', e.target.value)}
                    />
                  </div>

                  {/* Nome do Assessor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Assessor responsável <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={cn('input-base', errors.nomeAssessor && 'border-red-400 focus:ring-red-400')}
                      placeholder="Seu nome"
                      value={form.nomeAssessor}
                      onChange={(e) => setField('nomeAssessor', e.target.value)}
                    />
                    {errors.nomeAssessor && (
                      <p className="text-xs text-red-500 mt-1">{errors.nomeAssessor}</p>
                    )}
                  </div>

                  {/* Município */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Município
                    </label>
                    <input
                      type="text"
                      className="input-base"
                      placeholder="Guarujá"
                      value={form.municipio}
                      onChange={(e) => setField('municipio', e.target.value)}
                    />
                  </div>
                </div>

                <button
                  className="btn-primary w-full"
                  onClick={handleStep1}
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</>
                  ) : (
                    'Continuar'
                  )}
                </button>
              </>
            )}

            {/* ══ PASSO 2 ══════════════════════════════ */}
            {step === 2 && (
              <>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Template de indicação</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Temos um modelo padrão pronto para você usar agora.
                  </p>
                </div>

                {/* Preview readonly */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Pré-visualização
                  </p>
                  <TemplatePreview />
                  <p className="text-xs text-gray-400">
                    Você pode personalizar logotipo, cores e assinatura depois em{' '}
                    <span className="font-medium">Configurações</span>.
                  </p>
                </div>

                <div className="space-y-3">
                  <button className="btn-primary w-full" onClick={handleStep2}>
                    Usar template padrão
                    <span className="ml-1.5 text-[11px] font-normal opacity-80">(recomendado)</span>
                  </button>
                  <button
                    className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
                    onClick={handleStep2}
                  >
                    Personalizar depois nas configurações
                  </button>
                </div>
              </>
            )}

            {/* ══ PASSO 3 ══════════════════════════════ */}
            {step === 3 && (
              <>
                <div className="text-center space-y-1">
                  <div className="text-3xl mb-2">🎉</div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Perfeito! Vamos gerar sua primeira indicação?
                  </h1>
                  <p className="text-sm text-gray-500">
                    Experimente agora. Descreva um pedido real do seu gabinete.
                  </p>
                </div>

                <div className="space-y-2">
                  <textarea
                    className="textarea-base text-sm h-28"
                    placeholder="Ex: Solicitar roçagem e limpeza do terreno baldio na Rua das Palmeiras, 340, bairro Santa Cruz dos Navegantes. Pedido dos moradores."
                    value={textoDemo}
                    onChange={(e) => setTextoDemo(e.target.value)}
                    disabled={generating}
                  />
                  <p className="text-xs text-gray-400 text-right">{textoDemo.length} caracteres</p>
                </div>

                <div className="space-y-3">
                  <button
                    className="btn-primary w-full"
                    onClick={handleGerar}
                    disabled={generating || textoDemo.trim().length < 10}
                  >
                    {generating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</>
                    ) : (
                      <><Zap className="h-4 w-4" /> Gerar minha primeira indicação</>
                    )}
                  </button>

                  <button
                    className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
                    onClick={completeOnboarding}
                    disabled={generating}
                  >
                    Ir para o painel sem gerar agora
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Indicador de progresso textual */}
          <p className="text-center text-xs text-gray-400 pt-1">
            Passo {step} de 3
          </p>
        </div>
      </main>
    </div>
  );
}
