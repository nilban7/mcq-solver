import { AiSolveResult, McqOptionKey, VerificationStatus } from '../shared/types.js';

export interface SolverOptions {
  apiKey?: string;
  groqKey1?: string;
  groqKey2?: string;
  geminiKey?: string;
  provider?: 'gemini' | 'openai' | 'groq' | 'demo';
  enableVerification?: boolean;
}

// Track cooldowns when a key receives a 429 or quota error
const keyCooldowns = new Map<string, number>();

export function isKeyCoolingDown(key: string): boolean {
  const cd = keyCooldowns.get(key);
  if (!cd) return false;
  if (Date.now() > cd) {
    keyCooldowns.delete(key);
    return false;
  }
  return true;
}

export function markKeyRateLimited(key: string, cooldownMs = 60000) {
  keyCooldowns.set(key, Date.now() + cooldownMs);
}

const SAMPLE_DEMO_MCQS: Array<{
  question: string;
  options: Record<McqOptionKey, string>;
  answer: McqOptionKey;
  confidence: number;
  explanation: string;
}> = [
  {
    question: "What is the capital of France?",
    options: {
      A: "Berlin",
      B: "Madrid",
      C: "Paris",
      D: "Rome"
    },
    answer: "C",
    confidence: 0.98,
    explanation: "Paris has been the capital of France since 987 AD and is its largest metropolitan and cultural center."
  },
  {
    question: "Which semiconductor component converts Alternating Current (AC) into Direct Current (DC)?",
    options: {
      A: "Step-up Transformer",
      B: "Bridge Rectifier Diode",
      C: "Hartley Oscillator",
      D: "Operational Amplifier"
    },
    answer: "B",
    confidence: 0.96,
    explanation: "A rectifier utilizes unidirectional diode conduction to convert bidirectional AC voltage into pulsating DC voltage."
  },
  {
    question: "What is the time complexity of searching for an element in a balanced Binary Search Tree (AVL / Red-Black Tree)?",
    options: {
      A: "O(1)",
      B: "O(n)",
      C: "O(log n)",
      D: "O(n log n)"
    },
    answer: "C",
    confidence: 0.99,
    explanation: "Balanced binary search trees maintain an O(log n) height invariant, ensuring logarithmic search, insert, and delete operations."
  },
  {
    question: "Which organelle is universally referred to as the powerhouse of eukaryotic cells?",
    options: {
      A: "Ribosome",
      B: "Mitochondria",
      C: "Endoplasmic Reticulum",
      D: "Golgi Apparatus"
    },
    answer: "B",
    confidence: 0.99,
    explanation: "Mitochondria synthesize cellular ATP through oxidative phosphorylation and the Krebs cycle."
  },
  {
    question: "What is the acceleration due to gravity (g) at Earth's standard sea level?",
    options: {
      A: "8.9 m/s²",
      B: "9.8 m/s²",
      C: "10.8 m/s²",
      D: "12.0 m/s²"
    },
    answer: "B",
    confidence: 0.97,
    explanation: "Standard Earth gravitational acceleration is defined by convention as 9.80665 m/s²."
  }
];

let demoIndex = 0;

export async function solveMcq(
  imageBase64: string,
  options: SolverOptions = {}
): Promise<AiSolveResult> {
  const provider = options.provider || 'groq';

  if (provider === 'demo') {
    // Artificial small delay for realistic UX
    await new Promise((r) => setTimeout(r, 600));
    const sample = SAMPLE_DEMO_MCQS[demoIndex % SAMPLE_DEMO_MCQS.length];
    demoIndex++;

    return {
      question: sample.question,
      options: sample.options,
      answer: sample.answer,
      confidence: sample.confidence,
      explanation: sample.explanation,
      verificationStatus: 'VERIFIED',
      verifierAnswer: sample.answer,
      providerUsed: 'Demo Mode',
    };
  }

  if (provider === 'groq') {
    return solveWithFailoverPipeline(imageBase64, options);
  } else if (provider === 'gemini') {
    const key = (options.geminiKey || options.apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) {
      throw new Error('Gemini API key is missing. Please click Settings to add your key.');
    }
    const res = await solveWithGemini(imageBase64, key, options.enableVerification ?? true);
    return { ...res, providerUsed: 'Google Gemini' };
  } else {
    const key = (options.apiKey || process.env.OPENAI_API_KEY || '').trim();
    if (!key) {
      throw new Error('OpenAI API key is missing. Please click Settings to add your key.');
    }
    const res = await solveWithOpenAI(imageBase64, key, options.enableVerification ?? true);
    return { ...res, providerUsed: 'OpenAI GPT-4o' };
  }
}

async function solveWithFailoverPipeline(
  imageBase64: string,
  options: SolverOptions
): Promise<AiSolveResult> {
  // Collect candidate Groq keys
  const groqCandidates: Array<{ key: string; label: string }> = [];
  const k1 = (options.groqKey1 || options.apiKey || process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY || '').trim();
  const k2 = (options.groqKey2 || process.env.GROQ_API_KEY_2 || '').trim();

  if (k1) groqCandidates.push({ key: k1, label: 'Groq Key #1' });
  if (k2 && k2 !== k1) groqCandidates.push({ key: k2, label: 'Groq Key #2' });

  // Prioritize keys that are NOT on cooldown
  groqCandidates.sort((a, b) => {
    const aCool = isKeyCoolingDown(a.key) ? 1 : 0;
    const bCool = isKeyCoolingDown(b.key) ? 1 : 0;
    return aCool - bCool;
  });

  const groqErrors: string[] = [];

  // 1. Try each Groq key with auto-switch
  for (const { key, label } of groqCandidates) {
    try {
      console.log(`[Failover] Attempting vision solve with ${label}...`);
      const res = await solveWithGroq(imageBase64, key, options.enableVerification ?? true);
      return {
        ...res,
        providerUsed: `${label} (Qwen 3.8)`,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn(`[Failover] ${label} encountered error: ${errMsg}`);
      groqErrors.push(`${label}: ${errMsg}`);

      // If it looks like a rate limit (429) or quota error, set 60-second cooldown
      if (errMsg.includes('429') || errMsg.toLowerCase().includes('rate_limit') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
        console.warn(`[Failover] ${label} rate-limited. Putting on 60s cooldown, switching to next key...`);
        markKeyRateLimited(key, 60000);
      }
    }
  }

  // 2. If all Groq keys failed or exhausted, auto-try Gemini Emergency Fallback
  const geminiKey = (options.geminiKey || process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey) {
    console.log('[Failover] Groq keys unavailable or exhausted. Auto-switching to emergency Gemini fallback...');
    try {
      const geminiRes = await solveWithGemini(imageBase64, geminiKey, options.enableVerification ?? true);
      return {
        ...geminiRes,
        providerUsed: 'Gemini (Auto-Fallback)',
      };
    } catch (gemErr: any) {
      groqErrors.push(`Gemini Fallback: ${gemErr.message}`);
    }
  }

  // If no keys configured at all
  if (groqCandidates.length === 0 && !geminiKey) {
    throw new Error('API key is missing. Please click the Settings gear icon (⚙️) on desktop, enter your Groq API Key or Gemini Key, and click Save Configuration.');
  }

  throw new Error(`All solver keys failed during auto-failover: ${groqErrors.join(' | ')}`);
}


async function solveWithGroq(
  imageBase64: string,
  apiKey: string,
  enableVerification: boolean
): Promise<AiSolveResult> {
  const systemPrompt = `You are an expert academic MCQ solver and OCR reader.
Extract the question and options A, B, C, D from the image. Solve for the single correct answer.
Return strict JSON format:
{
  "question": "string",
  "options": {
    "A": "string",
    "B": "string",
    "C": "string",
    "D": "string"
  },
  "answer": "A" | "B" | "C" | "D" | null,
  "confidence": number between 0.0 and 1.0,
  "explanation": "string (concise 1-2 sentence explanation)",
  "ambiguous": boolean
}`;

  // Candidate models supported on Groq
  const candidateModels = [
    'qwen/qwen3.8-27b',
    'llama-3.2-11b-vision-instruct',
    'llama-3.2-90b-vision-instruct',
  ];

  let lastErrorText = '';
  for (const model of candidateModels) {
    try {
      console.log(`[Groq] Attempting vision call with model: ${model}`);
      const payload: Record<string, any> = {
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Solve this multiple choice question from the screen. Return valid JSON only.' },
              {
                type: 'image_url',
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
        temperature: 0.1,
      };

      if (model.includes('qwen')) {
        payload.reasoning_format = 'parsed';
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        lastErrorText = await response.text();
        console.warn(`[Groq] Model ${model} error (${response.status}): ${lastErrorText}`);
        continue;
      }

      const json = await response.json();
      const text = json?.choices?.[0]?.message?.content;
      if (!text) continue;

      const parsed = parseModelJson(text);
      let verificationStatus: VerificationStatus = parsed.confidence >= 0.85 ? 'VERIFIED' : 'REVIEW_REQUIRED';
      if (parsed.confidence < 0.70) {
        verificationStatus = 'REVIEW_REQUIRED';
      }

      return {
        question: parsed.question || 'Unable to extract question text',
        options: parsed.options || { A: '', B: '', C: '', D: '' },
        answer: parsed.answer,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
        explanation: parsed.explanation || '',
        ambiguous: parsed.ambiguous || false,
        verifierAnswer: parsed.answer,
        verificationStatus,
      };
    } catch (err: any) {
      lastErrorText = err?.message || String(err);
    }
  }

  throw new Error(`Groq API error: ${lastErrorText || 'Failed to call Groq vision model.'}`);
}

async function solveWithGemini(
  imageBase64: string,
  apiKey: string,
  enableVerification: boolean
): Promise<AiSolveResult> {
  // Strip header for Gemini inline_data
  const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = match ? match[1] : 'image/jpeg';
  const data = match ? match[2] : imageBase64;

  const systemPrompt = `You are a high-speed, precision MCQ solver and OCR parser for educational examinations.
Analyze the image containing a multiple-choice question.
Extract the question text and options A, B, C, D accurately.
Select the single best correct answer.
Return strict JSON matching this schema:
{
  "question": "string (the complete question statement)",
  "options": {
    "A": "string",
    "B": "string",
    "C": "string",
    "D": "string"
  },
  "answer": "A" | "B" | "C" | "D" | null,
  "confidence": number between 0.0 and 1.0,
  "explanation": "string (concise 1-2 sentence justification)",
  "ambiguous": boolean
}
DO NOT output any markdown ticks or explanation outside the JSON. Return raw valid JSON only.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: systemPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No response text received from Gemini');
  }

  const parsed = parseModelJson(text);

  let verificationStatus: VerificationStatus = 'VERIFIED';
  let verifierAnswer = parsed.answer;

  if (enableVerification && parsed.answer) {
    try {
      verifierAnswer = await runVerifier(parsed.question, parsed.options, apiKey, 'gemini');
      if (verifierAnswer !== parsed.answer) {
        verificationStatus = 'REVIEW_REQUIRED';
      }
    } catch {
      verificationStatus = parsed.confidence >= 0.85 ? 'VERIFIED' : 'REVIEW_REQUIRED';
    }
  }

  if (parsed.confidence < 0.70) {
    verificationStatus = 'REVIEW_REQUIRED';
  }

  return {
    question: parsed.question || 'Unable to extract question text',
    options: parsed.options || { A: '', B: '', C: '', D: '' },
    answer: parsed.answer,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
    explanation: parsed.explanation || '',
    ambiguous: parsed.ambiguous || false,
    verifierAnswer,
    verificationStatus,
  };
}

async function solveWithOpenAI(
  imageBase64: string,
  apiKey: string,
  enableVerification: boolean
): Promise<AiSolveResult> {
  const systemPrompt = `You are an expert academic MCQ solver and OCR reader.
Extract the question and options A, B, C, D from the image. Solve for the single correct answer.
Return strict JSON format:
{
  "question": "string",
  "options": {
    "A": "string",
    "B": "string",
    "C": "string",
    "D": "string"
  },
  "answer": "A" | "B" | "C" | "D" | null,
  "confidence": number between 0.0 and 1.0,
  "explanation": "string (concise 1-2 sentence explanation)",
  "ambiguous": boolean
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Solve this multiple choice question from the screen.' },
            {
              type: 'image_url',
              image_url: { url: imageBase64, detail: 'high' },
            },
          ],
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('No content returned from OpenAI');
  }

  const parsed = parseModelJson(text);

  let verificationStatus: VerificationStatus = 'VERIFIED';
  let verifierAnswer = parsed.answer;

  if (enableVerification && parsed.answer) {
    try {
      verifierAnswer = await runVerifier(parsed.question, parsed.options, apiKey, 'openai');
      if (verifierAnswer !== parsed.answer) {
        verificationStatus = 'REVIEW_REQUIRED';
      }
    } catch {
      verificationStatus = parsed.confidence >= 0.85 ? 'VERIFIED' : 'REVIEW_REQUIRED';
    }
  }

  if (parsed.confidence < 0.70) {
    verificationStatus = 'REVIEW_REQUIRED';
  }

  return {
    question: parsed.question || 'Unable to extract question text',
    options: parsed.options || { A: '', B: '', C: '', D: '' },
    answer: parsed.answer,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
    explanation: parsed.explanation || '',
    ambiguous: parsed.ambiguous || false,
    verifierAnswer,
    verificationStatus,
  };
}

async function runVerifier(
  question: string,
  options: Record<string, string>,
  apiKey: string,
  provider: 'gemini' | 'openai'
): Promise<McqOptionKey | null> {
  const prompt = `Solve this MCQ independently without bias. Return ONLY strict JSON: {"answer": "A"|"B"|"C"|"D"}
Question: ${question}
A: ${options.A || ''}
B: ${options.B || ''}
C: ${options.C || ''}
D: ${options.D || ''}`;

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.0 },
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    const p = parseModelJson(t);
    return (['A', 'B', 'C', 'D'].includes(p.answer) ? p.answer : null) as McqOptionKey | null;
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const t = j?.choices?.[0]?.message?.content;
    const p = parseModelJson(t);
    return (['A', 'B', 'C', 'D'].includes(p.answer) ? p.answer : null) as McqOptionKey | null;
  }
}

export function parseModelJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // Attempt markdown regex clean
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Failed to parse model response into JSON');
  }
}
