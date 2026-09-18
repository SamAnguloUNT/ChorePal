const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export const analyzeImage = async (
  base64Image: string,
  choreTitle: string
): Promise<{
  isComplete: boolean;
  confidence: number;
  description: string;
}> => {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
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
                  text: `You are a friendly and encouraging chore coach for children in a chore app called ChorePal.

A child claims to have completed this chore: "${choreTitle}"

Carefully analyze the photo and provide:
1. Whether the chore is complete or not
2. Specific encouraging feedback about what they did well
3. Specific constructive feedback on what could be improved
4. Always end with an encouraging message

Examples of good feedback:
- "Great job making your bed! The sheets look nice and smooth. Next time try to make sure the pillows are a little more centered and neat. Keep up the great work! 🌟"
- "I can see you tried to wash the dishes but there are still some dishes in the sink. Make sure all dishes are washed, rinsed and put away. You can do it! 💪"
- "Awesome job taking out the trash! The bin is empty and the bag is tied neatly. Maybe next time also wipe down the outside of the bin. Amazing effort! ⭐"

Reply with ONLY this exact JSON, no other text:
{
  "isComplete": true or false,
  "confidence": number between 0 and 1,
  "description": "Your detailed encouraging feedback here. Always mention what they did well AND what could be improved. End with encouragement."
}`
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
              temperature: 0.4,
              maxOutputTokens: 1000,
            }
          }),
        }
      );

      const data = await response.json();
      console.log('Gemini response:', JSON.stringify(data));

      // If high demand error wait and retry
      if (
        data.error?.message?.includes('high demand') ||
        data.error?.message?.includes('overloaded') ||
        data.error?.status === 'UNAVAILABLE'
      ) {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`Gemini busy, retrying... (attempt ${attempts + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
          continue;
        } else {
          return {
            isComplete: false,
            confidence: 0,
            description: 'AI is currently busy. Please wait a moment and try again! 🤖',
          };
        }
      }

      if (data.error) {
        throw new Error(data.error.message);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log('Gemini text:', text);

      if (!text) throw new Error('No response from Gemini');

      let jsonStr = text.replace(/```json|```/g, '').trim();

      if (!jsonStr.endsWith('}')) {
        jsonStr = jsonStr + '"}';
      }

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      let result;
      try {
        result = JSON.parse(jsonMatch[0]);
      } catch {
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
      attempts++;
      console.log(`Gemini error (attempt ${attempts}/${maxAttempts}):`, error.message);

      if (attempts < maxAttempts) {
        console.log(`Retrying in ${2 * attempts} seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
      } else {
        console.error('Max retries reached:', error);
        return {
          isComplete: false,
          confidence: 0,
          description: 'AI is currently busy. Please wait a moment and try again! 🤖',
        };
      }
    }
  }

  return {
    isComplete: false,
    confidence: 0,
    description: 'AI verification failed. Please try again.',
  };
};