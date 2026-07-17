import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createScriptPrisma, loadLocalEnvironment, printSetupResult } from "./lib/runtime";

const adminInputSchema = z.object({
  name: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(12, "A senha deve ter ao menos 12 caracteres."),
});

function ask(question: string) {
  return new Promise<string>((resolve) => {
    process.stdout.write(question);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (value: string) => resolve(value.trim()));
  });
}

function askHidden(question: string) {
  return new Promise<string>((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Este comando precisa de um terminal interativo para proteger a senha."));
      return;
    }

    let password = "";
    const wasRaw = process.stdin.isRaw;
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
    };

    const onData = (input: Buffer) => {
      const value = input.toString("utf8");
      if (value === "\r" || value === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(password);
      } else if (value === "\u0003") {
        cleanup();
        reject(new Error("Operação cancelada pelo usuário."));
      } else if (value === "\u007f") {
        password = password.slice(0, -1);
      } else if (!value.startsWith("\u001b")) {
        password += value;
      }
    };

    process.stdin.on("data", onData);
  });
}

async function main() {
  const local = loadLocalEnvironment();
  if (!local.exists || !local.env) {
    printSetupResult("Configuração", "pending", "preencha .env.local antes de criar o administrador.");
    process.exitCode = 1;
    return;
  }

  try {
    const name = await ask("Nome do administrador: ");
    const email = await ask("E-mail do administrador: ");
    const password = await askHidden("Senha (mínimo de 12 caracteres): ");
    const confirmation = await askHidden("Confirme a senha: ");

    if (password !== confirmation) {
      printSetupResult("Administrador", "failed", "a confirmação da senha não confere.");
      process.exitCode = 1;
      return;
    }

    const input = adminInputSchema.parse({ name, email, password });
    const env = local.env;
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      printSetupResult("Administrador", "failed", "não foi possível consultar usuários Auth. Revise a service role.");
      process.exitCode = 1;
      return;
    }

    let authUser = usersData.users.find((user) => user.email?.toLowerCase() === input.email.toLowerCase());
    let createdAuthUser = false;
    if (!authUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });
      if (error || !data.user) {
        printSetupResult("Administrador", "failed", "não foi possível criar o usuário Auth.");
        process.exitCode = 1;
        return;
      }
      authUser = data.user;
      createdAuthUser = true;
    }

    const prisma = createScriptPrisma(env);
    try {
      const profile = await prisma.profile.upsert({
        where: { authUserId: authUser.id },
        create: {
          authUserId: authUser.id,
          name: input.name,
          email: input.email,
          role: "RH_ADMIN",
          active: true,
        },
        update: {
          name: input.name,
          email: input.email,
          role: "RH_ADMIN",
          active: true,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: profile.id,
          action: "SETUP_ADMIN",
          entityType: "Profile",
          entityId: profile.id,
          newData: { role: "RH_ADMIN", active: true, source: "setup:admin" },
          reason: "Criação ou atualização segura do administrador inicial.",
        },
      });
      printSetupResult(
        "Administrador",
        "ok",
        createdAuthUser
          ? "usuário Auth e perfil RH_ADMIN criados. A senha não foi exibida nem armazenada localmente."
          : "usuário Auth já existia; perfil RH_ADMIN foi atualizado. A senha existente não foi alterada.",
      );
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "não foi possível concluir a operação.";
    printSetupResult("Administrador", "failed", message);
    process.exitCode = 1;
  }
}

void main();
