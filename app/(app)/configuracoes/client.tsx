'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Building2,
  Pencil,
  Check,
  X,
  Loader2,
  User,
  CreditCard,
  LogOut,
  ExternalLink,
  BadgeCheck,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlanoBadge } from '@/lib/planos';
import { VEREADOR_OPTIONS, getVereadorOption } from '@/lib/vereadores-options';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TenantData {
  nomeVereador: string;
  nomePartido: string;
  municipio: string;
  nomeAssessor: string;
  vereadorSlug: string;
  plano: string;
}

interface ConfiguracoesClientProps {
  tenant: TenantData;
  email: string;
  usageCount: number;
  usageLimit: number | null;
}

// ─────────────────────────────────────────────
// Seção 1 — Dados do Gabinete
// ─────────────────────────────────────────────

function DadosGabinete({ tenant }: { tenant: TenantData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [vereadorSlug, setVereadorSlug] = useState(tenant.vereadorSlug || 'outro');
  const [nomeVereador, setNomeVereador] = useState(tenant.nomeVereador);
  const [nomePartido, setNomePartido] = useState(tenant.nomePartido);
  const [municipio, setMunicipio] = useState(tenant.municipio || 'Guarujá');
  const [nomeAssessor, setNomeAssessor] = useState(tenant.nomeAssessor);

  // Campos exibidos (atualizados após salvar)
  const [display, setDisplay] = useState(tenant);

  const isBeta = getVereadorOption(display.vereadorSlug) !== null;

  function handleSlugChange(slug: string) {
    setVereadorSlug(slug);
    const perfil = getVereadorOption(slug);
    if (perfil) {
      setNomeVereador(perfil.nomeCompleto);
      setNomePartido(perfil.partido);
    } else {
      setNomeVereador('');
      setNomePartido('');
    }
  }

  function handleCancel() {
    // Restaura para os valores exibidos
    setVereadorSlug(display.vereadorSlug);
    setNomeVereador(display.nomeVereador);
    setNomePartido(display.nomePartido);
    setMunicipio(display.municipio);
    setNomeAssessor(display.nomeAssessor);
    setEditing(false);
  }

  async function handleSave() {
    if (!nomeVereador.trim()) {
      toast.error('Nome do vereador é obrigatório.');
      return;
    }
    if (!nomeAssessor.trim()) {
      toast.error('Nome do assessor é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/tenant/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vereadorSlug,
          nomeVereador: nomeVereador.trim(),
          nomePartido: nomePartido.trim(),
          municipio: municipio.trim(),
          nomeAssessor: nomeAssessor.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Erro ao salvar.');
      }

      setDisplay({
        ...display,
        vereadorSlug,
        nomeVereador: nomeVereador.trim(),
        nomePartido: nomePartido.trim(),
        municipio: municipio.trim(),
        nomeAssessor: nomeAssessor.trim(),
      });
      setEditing(false);
      toast.success('Dados atualizados com sucesso!');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  const slugIsBeta = getVereadorOption(vereadorSlug) !== null;

  return (
    <section className="card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Dados do Gabinete</h2>
            <p className="text-xs text-gray-500">Informações do vereador e assessor</p>
          </div>
        </div>

        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="btn-secondary text-xs shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        )}
      </div>

      {/* Badge de perfil */}
      <div>
        {isBeta ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <BadgeCheck className="h-3.5 w-3.5" />
            Perfil dedicado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
            <FileText className="h-3.5 w-3.5" />
            Template genérico
          </span>
        )}
      </div>

      {editing ? (
        /* ── Formulário de edição ── */
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Vereador</label>
            <select
              className="input-base text-sm"
              value={vereadorSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              disabled={saving}
            >
              {VEREADOR_OPTIONS.map((v) => (
                <option key={v.slug} value={v.slug}>{v.label}</option>
              ))}
              <option value="outro">Outro vereador</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nome completo do vereador
            </label>
            <input
              type="text"
              className={cn('input-base text-sm', slugIsBeta && 'bg-gray-50 text-gray-500')}
              value={nomeVereador}
              onChange={(e) => setNomeVereador(e.target.value)}
              readOnly={slugIsBeta}
              disabled={saving}
              placeholder="Nome completo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Partido</label>
              <input
                type="text"
                className={cn('input-base text-sm', slugIsBeta && 'bg-gray-50 text-gray-500')}
                value={nomePartido}
                onChange={(e) => setNomePartido(e.target.value)}
                readOnly={slugIsBeta}
                disabled={saving}
                placeholder="Ex: PT, PSDB..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Município</label>
              <input
                type="text"
                className="input-base text-sm"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                disabled={saving}
                placeholder="Ex: Guarujá"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nome do assessor
            </label>
            <input
              type="text"
              className="input-base text-sm"
              value={nomeAssessor}
              onChange={(e) => setNomeAssessor(e.target.value)}
              disabled={saving}
              placeholder="Seu nome"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              className="btn-primary text-sm flex-1 justify-center"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
              ) : (
                <><Check className="h-3.5 w-3.5" /> Salvar</>
              )}
            </button>
            <button
              className="btn-secondary text-sm"
              onClick={handleCancel}
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        /* ── Exibição dos dados ── */
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <DataRow label="Vereador" value={display.nomeVereador || '—'} />
          <DataRow label="Partido"  value={display.nomePartido  || '—'} />
          <DataRow label="Município" value={display.municipio   || '—'} />
          <DataRow label="Assessor" value={display.nomeAssessor || '—'} />
        </dl>
      )}
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5 truncate">{value}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────
// Seção 2 — Sobre o Plano
// ─────────────────────────────────────────────

function SobrePlano({
  plano,
  usageCount,
  usageLimit,
}: {
  plano: string;
  usageCount: number;
  usageLimit: number | null;
}) {
  const badge = getPlanoBadge(plano);

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
          <CreditCard className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Plano atual</h2>
          <p className="text-xs text-gray-500">Seu nível de acesso</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border', badge.cor)}>
          {badge.label}
        </span>
      </div>

      <p className="text-sm text-gray-600">
        {plano === 'BETA' && 'Você está no período de testes. Uso ilimitado.'}
        {plano === 'PRO_ASSESSOR' && 'Acesso ilimitado. Gere quantas indicações precisar.'}
        {plano === 'PRO_GABINETE' && 'Acesso ilimitado para todo o gabinete.'}
        {plano === 'CAMARA' && 'Acesso institucional ilimitado.'}
        {plano === 'TRIAL' && usageLimit !== null && (
          <>
            Plano de avaliação — {usageCount} de {usageLimit} indicações usadas nas últimas 3h.
          </>
        )}
        {plano === 'DEMO' && 'Plano demonstração. Use a página /demo para testar.'}
      </p>

      {plano === 'TRIAL' && usageLimit !== null && (
        <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              usageCount / usageLimit < 0.7 ? 'bg-green-400' :
              usageCount / usageLimit < 0.9 ? 'bg-yellow-400' : 'bg-red-400',
            )}
            style={{ width: `${Math.min(100, (usageCount / usageLimit) * 100)}%` }}
          />
        </div>
      )}

      <a
        href="/plano"
        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
      >
        Ver planos <ExternalLink className="h-3 w-3" />
      </a>
    </section>
  );
}

// ─────────────────────────────────────────────
// Seção 3 — Conta
// ─────────────────────────────────────────────

function Conta({ email }: { email: string }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    // Navega para a rota de signout do NextAuth v5
    window.location.href = '/api/auth/signout';
  }

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-gray-500" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Conta</h2>
          <p className="text-xs text-gray-500">Suas credenciais de acesso</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 font-medium mb-0.5">E-mail</p>
        <p className="text-sm text-gray-800 font-mono">{email}</p>
      </div>

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50 transition-colors"
      >
        {signingOut ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LogOut className="h-3.5 w-3.5" />
        )}
        Sair da conta
      </button>
    </section>
  );
}

// ─────────────────────────────────────────────
// Componente principal exportado
// ─────────────────────────────────────────────

export default function ConfiguracoesClient({
  tenant,
  email,
  usageCount,
  usageLimit,
}: ConfiguracoesClientProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="section-title">Configurações</h1>
        <p className="section-subtitle">Gerencie as preferências do seu gabinete.</p>
      </div>

      <DadosGabinete tenant={tenant} />
      <SobrePlano plano={tenant.plano} usageCount={usageCount} usageLimit={usageLimit} />
      <Conta email={email} />
    </div>
  );
}
