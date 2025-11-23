-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL DEFAULT 'openrouter',
    "openrouterApiKey" TEXT,
    "openrouterModel" TEXT NOT NULL DEFAULT 'anthropic/claude-3.5-sonnet',
    "localModelUrl" TEXT,
    "localModelName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
