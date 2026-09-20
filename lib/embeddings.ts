import OpenAI from "openai";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

const EMBEDDING_MODEL =
  process.env.NVIDIA_EMBEDDING_MODEL || "nvidia/nv-embedqa-e5-v5";

const getEmbeddingClient = () => {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured in server environment.");
  }

  return new OpenAI({ baseURL: NVIDIA_BASE_URL, apiKey, timeout: 30_000 });
};

export async function createEmbedding(input: string): Promise<number[]> {
  const response = await getEmbeddingClient().embeddings.create({
    model: EMBEDDING_MODEL,

    input,

    encoding_format: "float",
  });

  return response.data[0]?.embedding || [];
}

export async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  if (!inputs.length) return [];

  const response = await getEmbeddingClient().embeddings.create({
    model: EMBEDDING_MODEL,

    input: inputs,

    encoding_format: "float",
  });

  return response.data

    .sort((left, right) => left.index - right.index)

    .map((item) => item.embedding);
}
