import { defaultCalculationPolicies } from "../src/modules/calculations/domain/policies";
import { createScriptPrisma, loadLocalEnvironment } from "./lib/runtime";

async function main() {
  const local = loadLocalEnvironment();
  if (!local.env) {
    console.error("Configuração local indisponível. Preencha .env.local antes de inicializar políticas.");
    process.exitCode = 1;
    return;
  }
  const prisma = createScriptPrisma(local.env);
  try {
    const admin = await prisma.profile.findFirst({ where: { role: "RH_ADMIN", active: true }, select: { id: true } });
    if (!admin) throw new Error("Nenhum perfil RH_ADMIN ativo foi encontrado.");
    const policies = await prisma.$transaction(async (transaction) => {
      const result = [];
      for (const definition of defaultCalculationPolicies) {
        const { key, ...data } = definition;
        void key;
        result.push(await transaction.calculationPolicy.upsert({ where: { name: data.name }, create: data, update: {} }));
      }
      await transaction.auditLog.create({ data: { userId: admin.id, action: "CALCULATION_POLICY_DEFAULTS_ENSURED", entityType: "CalculationPolicy", entityId: "default-policies", newData: { count: result.length }, reason: "Políticas sintéticas iniciais da v0.3.0." } });
      return result;
    });
    console.log(`✓ ${policies.length} políticas de cálculo disponíveis.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
