const HF_MODEL = "BAAI/bge-small-en-v1.5";
const HF_API = "https://router.huggingface.co/hf-inference/models";

export async function embedText(text: string): Promise<number[]> {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN not set");

  const res = await fetch(`${HF_API}/${HF_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HF embedding failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as number[] | { embedding: number[] };
  const vec = Array.isArray(data) ? data : (data as { embedding: number[] }).embedding;
  if (!vec || vec.length !== 384) throw new Error("Invalid embedding shape");
  return vec;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embedText));
}
