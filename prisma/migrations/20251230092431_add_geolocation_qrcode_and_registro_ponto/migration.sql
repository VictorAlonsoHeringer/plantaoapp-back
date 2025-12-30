-- CreateEnum
CREATE TYPE "TipoRegistro" AS ENUM ('ENTRADA', 'SAIDA');

-- AlterEnum
ALTER TYPE "CandidaturaStatus" ADD VALUE 'EM_ANDAMENTO';
ALTER TYPE "CandidaturaStatus" ADD VALUE 'FINALIZADO';
ALTER TYPE "CandidaturaStatus" ADD VALUE 'ATRASADO';

-- AlterTable
ALTER TABLE "hospitals" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "plantoes" ADD COLUMN "qrCodeToken" TEXT,
ADD COLUMN "qrCodeGeneratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "registros_ponto" (
    "id" TEXT NOT NULL,
    "candidaturaId" TEXT NOT NULL,
    "tipo" "TipoRegistro" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "distanciaMetros" DOUBLE PRECISION NOT NULL,
    "qrCodeValidado" TEXT NOT NULL,
    "justificativaAtraso" TEXT,
    "atrasado" BOOLEAN NOT NULL DEFAULT false,
    "minutosAtraso" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plantoes_qrCodeToken_key" ON "plantoes"("qrCodeToken");

-- AddForeignKey
ALTER TABLE "registros_ponto" ADD CONSTRAINT "registros_ponto_candidaturaId_fkey" FOREIGN KEY ("candidaturaId") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
