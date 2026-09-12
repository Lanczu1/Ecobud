-- Enable pgvector in Supabase's dedicated extensions schema.
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en-PH',
    "audience" TEXT NOT NULL DEFAULT 'user',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "embedding" "extensions"."vector",
    "token_count" INTEGER,
    "character_count" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_chunks_document_id_fkey"
        FOREIGN KEY ("document_id")
        REFERENCES "knowledge_documents"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "knowledge_documents_category_idx" ON "knowledge_documents"("category");
CREATE INDEX "knowledge_documents_source_type_idx" ON "knowledge_documents"("source_type");
CREATE INDEX "knowledge_documents_source_id_idx" ON "knowledge_documents"("source_id");
CREATE INDEX "knowledge_documents_is_active_idx" ON "knowledge_documents"("is_active");
CREATE INDEX "knowledge_documents_language_idx" ON "knowledge_documents"("language");
CREATE UNIQUE INDEX "knowledge_chunks_document_chunk_key" ON "knowledge_chunks"("document_id", "chunk_index");
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");
CREATE INDEX "knowledge_chunks_chunk_index_idx" ON "knowledge_chunks"("chunk_index");
