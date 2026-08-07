export function isMobilePunchEnabled(value = process.env.MOBILE_PUNCH_ENABLED) {
  return value === "true";
}

export function requireMobilePunchReceiptSecret(value = process.env.MOBILE_PUNCH_RECEIPT_SECRET) {
  if (!value || value.length < 32) throw new Error("Configuração segura do piloto de ponto móvel pendente.");
  return value;
}
