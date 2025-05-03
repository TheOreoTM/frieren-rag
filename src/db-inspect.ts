import { ChromaClient } from "chromadb";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function inspectDb() {
    const chromaClient = new ChromaClient({ path: process.env.VECTOR_DB_URL });

    try {
        console.log("Connecting to ChromaDB...");
        const health = await chromaClient.heartbeat();
        console.log("ChromaDB Health:", health);

        const collections = await chromaClient.listCollections();
        console.log(
            "Collections:",
            collections.map((c) => c)
        );

        const collectionName = process.env.VECTOR_DB_COLLECTION_NAME || "frieren_chunks";
        console.log(`Checking collection: ${collectionName}`);

        const collection = await chromaClient.getCollection({ name: collectionName });

        const count = await collection.count();
        console.log(`Total items (chunks) in "${collectionName}": ${count}`);
    } catch (error) {
        console.error("Error accessing ChromaDB:", error);
        console.error("Ensure VECTOR_DB_URL in .env is correct (e.g., http://chroma:8000) and ChromaDB is running.");
    }
}

inspectDb();
