/**
 * Constantes de tempo em milissegundos
 */
export const TIME_CONSTANTS = {
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
};

/**
 * Verifica se o horário atual está dentro da janela de check-in
 * Check-in permitido: 5 minutos antes do início até o fim do plantão
 */
export function isWithinCheckInWindow(plantaoInicio: Date): boolean {
  const now = new Date();
  const cincoMinutosAntes = new Date(
    plantaoInicio.getTime() - TIME_CONSTANTS.FIVE_MINUTES
  );

  // Pode fazer check-in 5 minutos antes ou depois do início
  return now >= cincoMinutosAntes;
}

/**
 * Verifica se o check-out está atrasado
 * Atrasado = mais de 5 minutos após o fim do plantão
 */
export function isCheckOutLate(
  plantaoFim: Date,
  checkOutTime: Date = new Date()
): boolean {
  const cincoMinutosDepois = new Date(
    plantaoFim.getTime() + TIME_CONSTANTS.FIVE_MINUTES
  );

  return checkOutTime > cincoMinutosDepois;
}

/**
 * Calcula quantos minutos de atraso há no check-out
 * Retorna 0 se não houver atraso
 */
export function calculateCheckOutDelay(
  plantaoFim: Date,
  checkOutTime: Date = new Date()
): number {
  const cincoMinutosDepois = new Date(
    plantaoFim.getTime() + TIME_CONSTANTS.FIVE_MINUTES
  );

  if (checkOutTime <= cincoMinutosDepois) {
    return 0;
  }

  const diffMs = checkOutTime.getTime() - plantaoFim.getTime();
  return Math.floor(diffMs / TIME_CONSTANTS.ONE_MINUTE);
}

/**
 * Verifica se uma data está no passado
 */
export function isPast(date: Date): boolean {
  return date < new Date();
}

/**
 * Verifica se uma data está no futuro
 */
export function isFuture(date: Date): boolean {
  return date > new Date();
}

/**
 * Verifica se o plantão já começou
 */
export function hasPlantaoStarted(plantaoInicio: Date): boolean {
  return isPast(plantaoInicio);
}

/**
 * Verifica se o plantão já terminou
 */
export function hasPlantaoEnded(plantaoFim: Date): boolean {
  return isPast(plantaoFim);
}

/**
 * Formata minutos em uma string legível (ex: "15 minutos", "2 horas")
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hora${hours !== 1 ? 's' : ''}`;
  }

  return `${hours} hora${hours !== 1 ? 's' : ''} e ${remainingMinutes} minuto${
    remainingMinutes !== 1 ? 's' : ''
  }`;
}
