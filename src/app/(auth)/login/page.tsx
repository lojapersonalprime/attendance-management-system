import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ recuperar?: string }> }) {
  const params = await searchParams;
  const recoveringPassword = params.recuperar === "1";
  return (
    <AuthFrame
      description={recoveringPassword ? "Informe seu e-mail para receber as instruções de recuperação." : "Entre com sua conta para continuar."}
      eyebrow={recoveringPassword ? "RECUPERAR ACESSO" : "ACESSO PERSONAL PRIME"}
      title={recoveringPassword ? "Recupere sua senha" : "Acesso Personal Prime"}
    >
      <LoginForm initialRecovery={recoveringPassword} />
    </AuthFrame>
  );
}
