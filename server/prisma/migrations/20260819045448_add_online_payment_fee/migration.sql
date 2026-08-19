-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "onlinePaymentFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 2;
