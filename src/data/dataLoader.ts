import * as fs from "fs";
import * as path from "path";

export function loadTextData(filePath: string): string {
    try {
        return fs.readFileSync(filePath, "utf-8");
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return "";
    }
}

export function loadAllFrierenData(dataDir: string): string[] {
    if (!fs.existsSync(dataDir)) {
        console.error(`Data directory not found: ${dataDir}`);
        return [];
    }
    const fileNames = fs.readdirSync(dataDir);
    const allText: string[] = [];
    for (const fileName of fileNames) {
        const filePath = path.join(dataDir, fileName);
        if (fs.statSync(filePath).isFile() && fileName.endsWith(".txt")) {
            allText.push(loadTextData(filePath));
        }
    }
    return allText;
}
