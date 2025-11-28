-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "mid_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payment_request" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentTransaction_business_id_idx" ON "PaymentTransaction"("business_id");

-- CreateIndex
CREATE INDEX "PaymentTransaction_mid_id_idx" ON "PaymentTransaction"("mid_id");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_created_at_idx" ON "PaymentTransaction"("created_at");
