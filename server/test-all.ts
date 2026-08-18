import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  let allModels = [];
  try {
    let page = await ai.models.list();
    allModels.push(...Array.from(page));
  } catch (e) {
    console.error("List failed", e);
  }

  for (const modelObj of allModels) {
    const m = (modelObj as any).name.replace('models/', '');
    if (m.includes('audio') || m.includes('embedding') || m.includes('veo') || m.includes('imagen')) continue;
    
    try {
        console.log(`Testing ${m}...`);
        const resp = await ai.models.generateContent({
            model: m,
            contents: 'hi'
        });
        console.log(`SUCCESS with ${m}: ${resp.text}`);
        return; // found one!
    } catch (e: any) {
        console.log(`Failed ${m}: ${e.message}`);
    }
  }
}
run();
