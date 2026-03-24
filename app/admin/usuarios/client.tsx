'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Shield, X, Check } from 'lucide-react';

type Plano = 'DEMO' | 'TRIAL' | 'PRO_ASSESSOR' | 'PRO_GABINETE' | 'CAMARA';

type Usuario = {
  id: string;
  email: string;
  nome: string | null;
  name: string | null;
  isAdmin: boolean;
  onboardingComplete: boolean;
  criadoEm: Date | string;
  tenant: { id: string; nome: string; plano: string } | null;
};

const PLANOS: Plano[] = ['TRIAL', 'PRO_ASSESSOR', 'PRO_GABINETE', 'CAMARA', 'DEMO'];

const PLANO_LABELS: Record<string, string> = {
  DEMO:         'Demo',
  TRIAL:        'Trial',
  PRO_ASSESSOR: 'Pro Assessor',
  PRO_GABINETE: 'Pro Gabinete',
  CAMARA:       'Câmara',
};

const PLANO_COLORS: Record<string, string> = {
  DEMO:         'bg-gray-700 text-gray-300',
  TRIAL:        'bg-yellow-900/50 text-yellow-300',
  PRO_ASSESSOR: 'bg-blue-900/50 text-blue-300',
  PRO_GABINETE: 'bg-purple-900/50 text-purple-300',
  CAMARA:       'bg-green-900/50 text-green-300',
};

// ─── Modal genérico ────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Modal Criar Usuário ────────────────────────────────────
function ModalCriarUsuario({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [plano, setPlano] = useState<Plano>('TRIAL');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nome: nome || undefined, plano, isAdmin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar usuário');
      toast.success('Usuário criado com sucesso!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Criar Usuário" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">E-mail *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="usuario@exemplo.com"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Nome (opcional)</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="Nome completo"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Plano *</label>
          <select
            value={plano}
            onChange={(e) => setPlano(e.target.value as Plano)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {PLANOS.map((p) => (
              <option key={p} value={p}>{PLANO_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isAdmin"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <label htmlFor="isAdmin" className="text-sm text-gray-300">
            Conceder acesso de administrador
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white font-medium transition-colors"
          >
            {loading ? 'Criando...' : 'Criar usuário'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal Editar Usuário ───────────────────────────────────
function ModalEditarUsuario({ usuario, onClose, onSuccess }: { usuario: Usuario; onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState(usuario.email);
  const [nome, setNome] = useState(usuario.nome ?? usuario.name ?? '');
  const [plano, setPlano] = useState<Plano>((usuario.tenant?.plano as Plano) ?? 'TRIAL');
  const [isAdmin, setIsAdmin] = useState(usuario.isAdmin);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nome: nome || undefined, plano, isAdmin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao atualizar usuário');
      toast.success('Usuário atualizado!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Editar Usuário" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="Nome completo"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Plano</label>
          <select
            value={plano}
            onChange={(e) => setPlano(e.target.value as Plano)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {PLANOS.map((p) => (
              <option key={p} value={p}>{PLANO_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isAdminEdit"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <label htmlFor="isAdminEdit" className="text-sm text-gray-300">
            Acesso de administrador
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white font-medium transition-colors"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Componente principal ───────────────────────────────────
export function UsuariosClient({
  usuarios: initialUsuarios,
  currentUserId,
}: {
  usuarios: Usuario[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState(initialUsuarios);
  const [showCriar, setShowCriar] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [deletando, setDeletando] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    setShowCriar(false);
    setEditando(null);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja deletar este usuário?')) return;
    setDeletando(id);
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao deletar');
      toast.success('Usuário deletado');
      setUsuarios((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletando(null);
    }
  }

  return (
    <>
      {showCriar && (
        <ModalCriarUsuario onClose={() => setShowCriar(false)} onSuccess={refresh} />
      )}
      {editando && (
        <ModalEditarUsuario usuario={editando} onClose={() => setEditando(null)} onSuccess={refresh} />
      )}

      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Usuários</h1>
            <p className="text-gray-400 text-sm mt-1">{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} cadastrado{usuarios.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowCriar(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo usuário
          </button>
        </div>

        {/* Tabela */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          {usuarios.length === 0 ? (
            <div className="py-12 text-center text-gray-500">Nenhum usuário cadastrado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide px-5 py-3">Usuário</th>
                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide px-5 py-3">Tenant</th>
                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide px-5 py-3">Plano</th>
                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide px-5 py-3">Status</th>
                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide px-5 py-3">Cadastro</th>
                    <th className="text-right text-xs text-gray-400 uppercase tracking-wide px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-white font-medium">{u.nome ?? u.name ?? '—'}</span>
                              {u.isAdmin && (
                                <span title="Admin">
                                  <Shield className="h-3.5 w-3.5 text-red-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-gray-400 text-xs mt-0.5">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-300">
                        {u.tenant?.nome ?? <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {u.tenant?.plano ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLANO_COLORS[u.tenant.plano] ?? 'bg-gray-700 text-gray-300'}`}>
                            {PLANO_LABELS[u.tenant.plano] ?? u.tenant.plano}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {u.onboardingComplete ? (
                          <span className="flex items-center gap-1 text-green-400 text-xs">
                            <Check className="h-3.5 w-3.5" /> Ativo
                          </span>
                        ) : (
                          <span className="text-yellow-400 text-xs">Pendente</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {new Date(u.criadoEm).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditando(u)}
                            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded-md transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              onClick={() => handleDelete(u.id)}
                              disabled={deletando === u.id}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                              title="Deletar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
