-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "uptimeMonitorId" TEXT,
    "xuiPanelId" TEXT,
    "xuiInboundId" INTEGER,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XuiPanel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XuiPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TempKey" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "inboundId" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "vlessUri" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TempKey_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_xuiPanelId_fkey"
    FOREIGN KEY ("xuiPanelId") REFERENCES "XuiPanel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempKey" ADD CONSTRAINT "TempKey_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempKey" ADD CONSTRAINT "TempKey_panelId_fkey"
    FOREIGN KEY ("panelId") REFERENCES "XuiPanel"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
