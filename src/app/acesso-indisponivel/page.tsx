import { AuthFrame } from "@/components/auth/auth-frame";
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
  return <AuthFrame description={message.description} eyebrow="ACESSO MOBILE" title={message.title}><div className="border-t border-[var(--border)] pt-4"><LogoutButton /></div></AuthFrame>;
}
