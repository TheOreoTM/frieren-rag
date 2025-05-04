import { config } from "../config";
import { ChromaClient, Collection, IncludeEnum } from "chromadb";

import { OpenAIEmbeddings } from "@langchain/openai";
import type { Embeddings } from "@langchain/core/embeddings";

export interface VectorDatabase {
    initialize(): Promise<void>;
    addDocuments(docs: { content: string; metadata?: any }[], embeddings: number[][]): Promise<void>;
    search(queryEmbedding: number[], k: number): Promise<{ chunk: string; metadata?: any }[]>;
}

export class InMemoryVectorDB implements VectorDatabase {
    private vectors: { embedding: number[]; chunk: string; metadata?: any }[] = [];

    async initialize(): Promise<void> {
        console.log("Using in-memory vector database.");
        this.vectors = []; // Clear on initialize
    }

    async addDocuments(docs: { content: string; metadata?: any }[], embeddings: number[][]): Promise<void> {
        if (docs.length !== embeddings.length) {
            throw new Error("Mismatched number of documents and embeddings.");
        }
        for (let i = 0; i < docs.length; i++) {
            this.vectors.push({ embedding: embeddings[i], chunk: docs[i].content, metadata: docs[i].metadata });
        }
        console.log(`Added ${docs.length} documents to in-memory database.`);
    }

    async search(queryEmbedding: number[], k: number): Promise<{ chunk: string; metadata?: any }[]> {
        const results: { chunk: string; metadata?: any; similarity: number }[] = [];
        for (const vector of this.vectors) {
            const similarity = this.cosineSimilarity(queryEmbedding, vector.embedding);
            results.push({ chunk: vector.chunk, metadata: vector.metadata, similarity });
        }
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, k);
    } // Simple Cosine Similarity

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;
        if (vecA.length !== vecB.length) {
            // This should ideally not happen if embeddings are generated correctly
            console.error("Vector dimension mismatch in similarity calculation.");
            return 0;
        }
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            magnitudeA += vecA[i] * vecA[i];
            magnitudeB += vecB[i] * vecB[i];
        }
        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);
        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }
        return dotProduct / (magnitudeA * magnitudeB);
    }
}

// --- ChromaDB Vector Database Implementation ---
export class ChromaVectorDB implements VectorDatabase {
    private client: ChromaClient;
    private collection: Collection | undefined;
    private collectionName: string;
    // *** ADD THIS LINE ***
    private embeddingFunctionClient: Embeddings; // To pass to createCollection

    constructor() {
        this.client = new ChromaClient({ path: config.vectorDbUrl });
        this.collectionName = config.vectorDbCollectionName;

        // *** ADD THIS BLOCK TO CREATE THE EMBEDDING CLIENT INSTANCE ***
        // This is the same logic you likely have in src/embeddings/embeddingClient.ts
        if (config.embeddingModelName.includes("text-embedding")) {
            // Covers OpenAI models
            if (!config.openaiApiKey) {
                throw new Error("OPENAI_API_KEY not set for OpenAI embeddings.");
            }
            this.embeddingFunctionClient = new OpenAIEmbeddings({
                apiKey: config.openaiApiKey,
                model: config.embeddingModelName,
                // Optional: Explicitly set dimensions if you want 1536, but let's use 3072 for now
                // dimensions: 1536
            });
        } else if (config.embeddingModelName.includes("embedding-001")) {
            // Covers Google models
            throw new Error("Google is not yet supported.");
        } else {
            throw new Error(`Unsupported embedding model for ChromaDB integration: ${config.embeddingModelName}`);
        }
        // *************************************************************
    }

    async initialize(): Promise<void> {
        try {
            this.collection = await this.client.getCollection({ name: this.collectionName });
            console.log(`Connected to existing ChromaDB collection: ${this.collectionName}`);
        } catch (error) {
            console.log(`ChromaDB collection "${this.collectionName}" not found, creating...`);
            this.collection = await this.client.createCollection({
                name: this.collectionName,
                // *** PASS THE EMBEDDING FUNCTION INSTANCE HERE ***
                embeddingFunction: this.embeddingFunctionClient as any, // Cast might still be needed
            });
            console.log(`Created new ChromaDB collection: ${this.collectionName} with specified embedding function.`); // Adjusted log message
        }
    } // Keep addDocuments as is (or using upsert if you switched)

    async addDocuments(docs: { content: string; metadata?: any }[], embeddings: number[][]): Promise<void> {
        if (!this.collection) throw new Error("Chroma collection not initialized.");
        if (docs.length !== embeddings.length) throw new Error("Mismatched number of documents and embeddings."); // Use more unique IDs as before

        const ids = docs.map((_, i) => `doc_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`);
        const documents = docs.map((doc) => doc.content);
        const metadatas = docs.map((doc) => doc.metadata || {});

        // *** Optional: Keep console logs for debugging ***
        // console.log("Prepared data for ChromaDB:");
        // console.log("IDs:", ids);
        // console.log("Documents (first 5):", documents.slice(0, 5));
        // console.log("Metadatas (first 5):", metadatas.slice(0, 5));
        // console.log("Embeddings (first 5, first 10 dimensions):");
        // embeddings.slice(0, 5).forEach((emb, index) => {
        //     console.log(`  Emb ${index}: [${emb.slice(0, 10).join(', ')}...] (dimension: ${emb.length})`);
        // });
        // console.log(`Total embeddings: ${embeddings.length}`);
        // *********************************************

        try {
            // *** USE add or upsert ***
            await this.collection.add({
                // Or await this.collection.upsert({
                ids: ids,
                embeddings: embeddings, // Still provide the embeddings you generated
                documents: documents,
                metadatas: metadatas,
            });
            console.log(`Added/Upserted ${docs.length} documents to ChromaDB collection: ${this.collectionName}`);
        } catch (error) {
            console.error("Error adding/upserting documents to ChromaDB:", error);
            throw error; // Re-throw
        }
    } // Keep search as is

    async search(queryEmbedding: number[], k: number): Promise<{ chunk: string; metadata?: any }[]> {
        if (!this.collection) throw new Error("Chroma collection not initialized.");

        try {
            const results = await this.collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: k,
                include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
            });

            const relevantData: { chunk: string; metadata?: any }[] = [];
            if (results.documents && results.documents[0]) {
                for (let i = 0; i < results.documents[0].length; i++) {
                    const chunk = results.documents[0][i];
                    const metadata = results.metadatas?.[0]?.[i];
                    if (chunk) {
                        relevantData.push({ chunk: chunk, metadata: metadata || {} });
                    }
                }
            }
            return relevantData;
        } catch (error) {
            console.error("Error searching ChromaDB:", error);
            throw error;
        }
    }
}
