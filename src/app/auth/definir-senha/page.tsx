import { AuthFrame } from "@/components/auth/auth-frame";
import { PasswordUpdateForm } from "@/components/auth/password-update-form";

export default function DefinePasswordPage() {
  return <AuthFrame description="Crie uma senha segura para acessar seu ponto pelo celular." eyebrow="PRIMEIRO ACESSO" title="Defina sua senha"><PasswordUpdateForm /></AuthFrame>;
}
