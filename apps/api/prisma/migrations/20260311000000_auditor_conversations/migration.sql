-- CreateTable
CREATE TABLE "auditor_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nueva conversación',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auditor_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditor_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditor_conversations_user_id_idx" ON "auditor_conversations"("user_id");

-- CreateIndex
CREATE INDEX "auditor_conversations_updated_at_idx" ON "auditor_conversations"("updated_at");

-- CreateIndex
CREATE INDEX "auditor_messages_conversation_id_idx" ON "auditor_messages"("conversation_id");

-- AddForeignKey
ALTER TABLE "auditor_conversations" ADD CONSTRAINT "auditor_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditor_messages" ADD CONSTRAINT "auditor_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "auditor_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
