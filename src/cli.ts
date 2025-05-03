// src/cli.ts
import { VectorDatabase } from "./vectorDb/vectorDbClient";
import { queryFrierenRAG } from "./rag/ragService";
import * as readline from "readline";
import type { BuildPromptOptions } from "./prompt";

export const runCli = async (vectorDb: VectorDatabase) => {
    console.log("\nFrieren RAG System CLI Ready!");
    console.log("Type your questions about Frieren.");
    console.log("Type ':lang <language>' to set language (e.g., ':lang Japanese')");
    console.log("Type ':guess <on|off>' to toggle educated guesses (e.g., ':guess on')");
    console.log("Type ':show options' to see current settings.");
    console.log("Type 'quit' or 'exit' to close.");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    let currentOptions: BuildPromptOptions = {
        language: "English",
        allowEducatedGuess: false,
    };

    rl.on("line", async (input) => {
        const line = input.trim();

        if (line.toLowerCase() === "quit" || line.toLowerCase() === "exit") {
            rl.close();
            return;
        }

        if (line === "") {
            console.log("Please enter a question or command.");
            console.log("\nType your question:");
            return;
        }

        if (line.startsWith(":")) {
            const parts = line.slice(1).split(" ");
            const command = parts[0].toLowerCase();
            const value = parts.slice(1).join(" ").trim();

            switch (command) {
                case "lang":
                    if (value) {
                        currentOptions.language = value;
                        console.log(`Language set to: ${currentOptions.language}`);
                    } else {
                        console.log("Usage: :lang <language>");
                    }
                    break;
                case "guess":
                    if (value === "on") {
                        currentOptions.allowEducatedGuess = true;
                        console.log("Educated guesses turned ON. Responses may include disclaimers.");
                    } else if (value === "off") {
                        currentOptions.allowEducatedGuess = false;
                        console.log("Educated guesses turned OFF. Will state if info is not found.");
                    } else {
                        console.log("Usage: :guess <on|off>");
                    }
                    break;
                case "show":
                    if (value === "options") {
                        console.log("\nCurrent Options:");
                        console.log(`  Language: ${currentOptions.language}`);
                        console.log(`  Educated Guesses: ${currentOptions.allowEducatedGuess ? "On" : "Off"}`);
                        console.log("");
                    } else {
                        console.log("Usage: :show options");
                    }
                    break;
                default:
                    console.log(`Unknown command: :${command}`);
                    console.log("Available commands: :lang, :guess, :show options");
            }
            console.log("\nType your question:");
            return;
        }

        console.log(`\nUser: ${line}`);
        const answer = await queryFrierenRAG(line, vectorDb, currentOptions);
        console.log(`\nAI: ${answer}`);
        console.log("\nType your next question:");
    });

    rl.on("close", () => {
        console.log("Exiting Frieren RAG System. Farewell!");
        process.exit(0);
    });

    console.log("Type your question:");
};
