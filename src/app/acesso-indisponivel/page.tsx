import { LogoutButton } from "@/components/auth/logout-button";

const messages = {
  "perfil-ausente": {
    title: "Seu acesso ainda não está disponível.",
    description: "Não encontramos um perfil ativo vinculado à sua conta. Procure o RH.",
  },
  "perfil-inativo": {
    title: "Seu acesso está inativo.",
    description: "O acesso desta conta foi desativado. Procure o RH.",
  },
  "acesso-ausente": {
    title: "Seu acesso ao ponto pelo celular ainda não está disponível.",
    description: "O RH ainda precisa concluir a configuração do seu acesso.",
  },
  "acesso-inativo": {
    title: "Acesso pelo celular desativado.",
    description: "Procure o RH para verificar a liberação do ponto pelo celular.",
  },
} as const;

export default async function AccessUnavailablePage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  const message = messages[motivo as keyof typeof messages] ?? messages["acesso-ausente"];
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-5"><section className="w-full max-w-md rounded-xl border bg-white p-7 shadow-sm"><p className="text-lg font-bold">Personal Prime</p><h1 className="mt-7 text-2xl font-bold tracking-tight">{message.title}</h1><p className="mt-3 text-sm text-[var(--muted-foreground)]">{message.description}</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">Você continua autenticado, mas não tem autorização para acessar o portal neste momento.</p><div className="mt-7 border-t pt-3"><LogoutButton /></div></section></main>;
}
