import "dotenv/config";

export const config = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,

    vectorDbType: process.env.VECTOR_DB_TYPE || "memory",

    vectorDbUrl: process.env.VECTOR_DB_URL || "http://localhost:8000",
    vectorDbCollectionName: process.env.VECTOR_DB_COLLECTION_NAME || "frieren_chunks",

    chunkSize: parseInt(process.env.CHUNK_SIZE || "1000", 10),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || "200", 10),
    retrievalTopK: parseInt(process.env.RETRIEVAL_TOP_K || "5", 10),
    llmModelName: process.env.LLM_MODEL_NAME || "gpt-4o-mini",
    embeddingModelName: process.env.EMBEDDING_MODEL_NAME || "text-embedding-3-small",
    frierenDataDir: process.env.FRIEREN_DATA_DIR || "./src/data/raw/",
};

if (config.vectorDbType !== "memory" && config.vectorDbType !== "chroma") {
    console.warn(`Warning: Invalid VECTOR_DB_TYPE "${config.vectorDbType}". Defaulting to 'memory'.`);
    config.vectorDbType = "memory";
}

if (!config.openaiApiKey && !config.googleApiKey) {
    console.error("Error: Neither OPENAI_API_KEY nor GOOGLE_API_KEY is set. LLM and Embeddings might fail.");
    process.exit(1);
}
