import { VectorDatabase } from "./vectorDb/vectorDbClient";
import { queryFrierenRAG } from "./rag/ragService";
import * as readline from "readline";

export const runCli = async (vectorDb: VectorDatabase) => {
    console.log("\nFrieren RAG System CLI Ready!");
    console.log("Type your questions about Frieren. Type 'quit' or 'exit' to close.");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.on("line", async (input) => {
        const query = input.trim();
        if (query.toLowerCase() === "quit" || query.toLowerCase() === "exit") {
            rl.close();
            return;
        }

        if (query === "") {
            console.log("Please enter a question.");
            return;
        }

        console.log(`\nUser: ${query}`);
        // Use the non-streaming function for CLI
        const answer = await queryFrierenRAG(query, vectorDb);
        console.log(`\nAI: ${answer}`);
        console.log("\nType your next question:");
    });

    rl.on("close", () => {
        console.log("Exiting Frieren RAG System. Farewell!");
        process.exit(0);
    });

    console.log("Type your question:");
};
