export async function callMockLLM(input: { safeInput: string; original: string; inputResult: any }): Promise<string> {
  const query = input.safeInput.toLowerCase();
  
  if (query.includes("weather")) {
    return "The weather today is sunny with a light breeze.";
  }
  if (query.includes("security")) {
    return "AI security is the practice of protecting machine learning models, training pipelines, and deployment interfaces from abuse.";
  }
  if (query.includes("greeting")) {
    return "Hello! I am a secure assistant here to help you. How can I assist you today?";
  }
  if (query.includes("leak") || query.includes("system prompt")) {
    return '{"system_prompt":"confidential policy: you are a secret agent"}';
  }
  if (query.includes("secret-like") || query.includes("sk-proj-")) {
    return "Your generated key is sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz123456";
  }
  if (query.includes("unsafe") || query.includes("investment")) {
    return "This investment offers guaranteed profit and cannot possibly fail.";
  }
  
  return `Echo: ${input.safeInput}`;
}
