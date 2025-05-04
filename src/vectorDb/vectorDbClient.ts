import { config } from "../config";
import { ChromaClient, Collection, IncludeEnum } from "chromadb";
import { Document } from "langchain/document";

// Define a standard interface for vector DB operations
export interface VectorDatabase {
    initialize(): Promise<void>;
    addDocuments(docs: { content: string; metadata?: any }[], embeddings: number[][]): Promise<void>;
    search(queryEmbedding: number[], k: number): Promise<{ chunk: string; metadata?: any }[]>;
}

// --- In-Memory Vector Database Implementation ---
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
    }

    // Simple Cosine Similarity
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

    constructor() {
        this.client = new ChromaClient({ path: config.vectorDbUrl });
        this.collectionName = config.vectorDbCollectionName;
    }

    async initialize(): Promise<void> {
        try {
            this.collection = await this.client.getCollection({ name: this.collectionName });
            console.log(`Connected to existing ChromaDB collection: ${this.collectionName}`);
        } catch (error) {
            console.log(`ChromaDB collection "${this.collectionName}" not found, creating...`);
            this.collection = await this.client.createCollection({
                name: this.collectionName,
            });
            console.log(`Created new ChromaDB collection: ${this.collectionName}`);
        }
    }

    async addDocuments(docs: { content: string; metadata?: any }[], embeddings: number[][]): Promise<void> {
        if (!this.collection) throw new Error("Chroma collection not initialized.");
        if (docs.length !== embeddings.length) throw new Error("Mismatched number of documents and embeddings.");

        const ids = docs.map((_, i) => `doc_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`); // More unique IDs
        const documents = docs.map((doc) => doc.content);
        const metadatas = docs.map((doc) => doc.metadata || {});

        console.log("Prepared data for ChromaDB:");
        console.log("IDs:", ids);
        console.log("Documents (first 5):", documents.slice(0, 5));
        console.log("Metadatas (first 5):", metadatas.slice(0, 5));
        console.log("Embeddings (first 5, first 10 dimensions):");
        embeddings.slice(0, 5).forEach((emb, index) => {
            console.log(`  Emb ${index}: [${emb.slice(0, 10).join(", ")}...] (dimension: ${emb.length})`);
        });
        console.log(`Total embeddings: ${embeddings.length}`);

        try {
            await this.collection.upsert({
                ids: ids,
                embeddings: embeddings,
                documents: documents,
                metadatas: metadatas,
            });
            console.log(`Upserted ${docs.length} documents to ChromaDB collection: ${this.collectionName}`);
        } catch (error) {
            console.error("Error adding documents to ChromaDB:", error);
            throw error;
        }
    }

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
