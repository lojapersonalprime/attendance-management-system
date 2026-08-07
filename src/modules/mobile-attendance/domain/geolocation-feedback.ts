export function geolocationFailureMessage(code: number) {
  if (code === 1) return "Precisamos da sua localização para validar o registro.";
  if (code === 2) return "Não foi possível obter sua localização.";
  return "Não foi possível confirmar sua localização agora. Tente novamente.";
}
