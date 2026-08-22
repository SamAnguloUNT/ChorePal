const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export const analyzeImage = async (
  base64Image: string,
  choreTitle: string
): Promise<{
  isComplete: boolean;
  confidence: number;
  description: string;
}> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Chore to verify: "${choreTitle}". Does this photo show the chore is completed? Reply with only valid JSON like this: {"isComplete": true, "confidence": 0.9, "description": "brief explanation"}`
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          }
        }),
      }
    );

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data));

    if (data.error) {
      console.error('Gemini API error:', data.error);
      throw new Error(data.error.message);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('Gemini text:', text);

    if (!text) throw new Error('No response from Gemini');

    // Try to extract and complete partial JSON
    let jsonStr = text.replace(/```json|```/g, '').trim();

    // If JSON is cut off try to complete it
    if (!jsonStr.endsWith('}')) {
      jsonStr = jsonStr + '"}';
    }

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      // If still failing extract what we can
      const isComplete = jsonStr.includes('"isComplete": true') || jsonStr.includes('"isComplete":true');
      const confidenceMatch = jsonStr.match(/"confidence":\s*([\d.]+)/);
      const descMatch = jsonStr.match(/"description":\s*"([^"]+)/);
      result = {
        isComplete,
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
        description: descMatch ? descMatch[1] : 'Chore verified.',
      };
    }

    console.log('Parsed result:', result);

    return {
      isComplete: result.isComplete ?? false,
      confidence: result.confidence ?? 0,
      description: result.description ?? 'Unable to verify.',
    };

  } catch (error: any) {
    console.error('Gemini error:', error);
    return {
      isComplete: false,
      confidence: 0,
      description: 'AI verification failed. Parent review required.',
    };
  }
};