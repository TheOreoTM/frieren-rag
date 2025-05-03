export interface BuildPromptOptions {
    language?: string;
    allowEducatedGuess?: boolean; // Toggle educated guesses with disclaimer
}

export function buildPrompt(context: string, userQuery: string, options: BuildPromptOptions = {}): string {
    const { language = "English", allowEducatedGuess = false } = options;

    let prompt = `You are an AI assistant providing information about Frieren: Beyond Journey's End.\n`;

    prompt += `Respond in ${language}.\n`;

    prompt += `Use the following information provided in the "Context" section to answer the "User Question".\n`;
    prompt += `Synthesize the answer by combining relevant details from the provided Context.\n`;

    if (allowEducatedGuess) {
        prompt += `If the necessary information is not directly available but can be reasonably inferred from the Context, you may make an educated guess.\n`;
        prompt += `However, you MUST clearly state at the end of your response if any part of the answer was an educated guess based on inference, and state that it may not be accurate.\n`;
    } else {
        prompt += `If the necessary information to answer the question is not present in the Context, state clearly: "I cannot find the answer in the provided information."\n`;
        prompt += `Do not include information from outside the provided context.\n`;
    }

    prompt += `\nContext:\n${context}\n\n`;
    prompt += `User Question: ${userQuery}\n\n`;
    prompt += `Answer:`;

    return prompt;
}
