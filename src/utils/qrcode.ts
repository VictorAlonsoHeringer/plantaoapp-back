import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface QRCodePayload {
  plantaoId: string;
  hospitalId: string;
  timestamp: number;
}

/**
 * Gera um token QR Code JWT assinado para um plantão
 * Token expira em 24 horas
 */
export function generateQRToken(plantaoId: string, hospitalId: string): string {
  const payload: QRCodePayload = {
    plantaoId,
    hospitalId,
    timestamp: Date.now(),
  };

  // Token válido por 24 horas
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Valida e decodifica um token QR Code
 * Retorna o payload se válido, ou null se inválido/expirado
 */
export function validateQRToken(token: string): QRCodePayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as QRCodePayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Verifica se um token QR Code pertence a um plantão específico
 */
export function isQRTokenValid(
  token: string,
  expectedPlantaoId: string
): boolean {
  const payload = validateQRToken(token);

  if (!payload) {
    return false;
  }

  return payload.plantaoId === expectedPlantaoId;
}

/**
 * Gera um hash único para o QR Code (usado como identificador único)
 */
export function generateQRCodeHash(plantaoId: string): string {
  const timestamp = Date.now().toString();
  return crypto
    .createHash('sha256')
    .update(`${plantaoId}-${timestamp}`)
    .digest('hex');
}
