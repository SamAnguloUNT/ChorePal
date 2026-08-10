const VISION_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;

const CHORE_EXPECTATIONS: Record<string, {
  required: string[];
  forbidden: string[];
  description: string;
}> = {
  'take out trash': {
    required: ['trash', 'garbage', 'bin', 'waste', 'bag', 'outdoor', 'can', 'recycling', 'dumpster', 'rubbish'],
    forbidden: ['dog', 'cat', 'animal', 'pet', 'toy', 'person', 'face', 'selfie'],
    description: 'Should show trash bags, bins, or garbage area outside',
  },
  'make bed': {
    required: ['bed', 'pillow', 'blanket', 'sheet', 'mattress', 'bedroom', 'comforter', 'duvet'],
    forbidden: ['messy', 'cluttered'],
    description: 'Should show a neatly made bed with pillows',
  },
  'wash dishes': {
    required: ['dish', 'plate', 'sink', 'kitchen', 'cup', 'bowl', 'utensil', 'cutlery'],
    forbidden: ['dirty', 'food residue'],
    description: 'Should show clean dishes or a clean sink',
  },
  'clean room': {
    required: ['room', 'floor', 'bedroom', 'furniture', 'organized', 'tidy'],
    forbidden: ['messy', 'cluttered', 'disorder'],
    description: 'Should show a tidy organized room',
  },
  'vacuum': {
    required: ['vacuum', 'floor', 'carpet', 'rug'],
    forbidden: ['dirty', 'messy'],
    description: 'Should show vacuumed floors or carpet',
  },
  'mow lawn': {
    required: ['grass', 'lawn', 'yard', 'outdoor', 'garden', 'mower', 'green'],
    forbidden: [],
    description: 'Should show a mowed lawn',
  },
  'wash car': {
    required: ['car', 'vehicle', 'automobile', 'water', 'clean'],
    forbidden: ['dirty'],
    description: 'Should show a clean car being washed',
  },
  'do laundry': {
    required: ['laundry', 'clothes', 'washing machine', 'dryer', 'folded', 'clothing'],
    forbidden: [],
    description: 'Should show clean laundry or washing machine',
  },
  'clean bathroom': {
    required: ['bathroom', 'toilet', 'sink', 'bath', 'shower', 'mirror', 'tile'],
    forbidden: ['dirty', 'messy'],
    description: 'Should show a clean bathroom',
  },
  'sweep floor': {
    required: ['floor', 'broom', 'sweep', 'tile', 'clean floor', 'hardwood'],
    forbidden: ['dirty', 'messy'],
    description: 'Should show a swept clean floor',
  },
  'feed pet': {
    required: ['dog', 'cat', 'pet', 'animal', 'bowl', 'food', 'feeding'],
    forbidden: [],
    description: 'Should show pet being fed or food bowl',
  },
  'clean kitchen': {
    required: ['kitchen', 'counter', 'stove', 'sink', 'clean', 'appliance'],
    forbidden: ['dirty', 'messy'],
    description: 'Should show a clean kitchen',
  },
};

const findChoreExpectations = (choreTitle: string) => {
  const titleLower = choreTitle.toLowerCase();
  for (const [key, value] of Object.entries(CHORE_EXPECTATIONS)) {
    if (titleLower.includes(key)) return { key, ...value };
  }
  const keywords = titleLower.split(' ');
  for (const [key, value] of Object.entries(CHORE_EXPECTATIONS)) {
    const choreKeywords = key.split(' ');
    const hasMatch = choreKeywords.some(ck =>
      keywords.some(k => k.includes(ck) || ck.includes(k))
    );
    if (hasMatch) return { key, ...value };
  }
  return null;
};

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
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [
              { type: 'LABEL_DETECTION', maxResults: 20 },
              { type: 'OBJECT_LOCALIZATION', maxResults: 20 },
            ],
          }],
        }),
      }
    );

    const data = await response.json();
    const labels = data.responses[0]?.labelAnnotations || [];
    const objects = data.responses[0]?.localizedObjectAnnotations || [];

    const allDetected = [
      ...labels.map((l: any) => l.description.toLowerCase()),
      ...objects.map((o: any) => o.name.toLowerCase()),
    ];

    console.log('AI detected:', allDetected);
    console.log('Chore title:', choreTitle);

    const expectations = findChoreExpectations(choreTitle);
    const topLabels = allDetected.slice(0, 5).join(', ');

    if (!expectations) {
      // No specific expectations — stricter generic check
      const obviouslyWrong = ['dog', 'cat', 'animal', 'pet', 'person', 'selfie', 'face', 'cartoon'];
      const hasWrongContent = allDetected.some(label =>
        obviouslyWrong.some(wrong => label.includes(wrong))
      );
      if (hasWrongContent) {
        return {
          isComplete: false,
          confidence: 0.1,
          description: `❌ This doesn't look like a completed chore. AI detected: ${topLabels}.`,
        };
      }
      return {
        isComplete: false,
        confidence: 0.4,
        description: `⚠️ AI couldn't verify this chore. Detected: ${topLabels}. Please retake photo showing the completed chore.`,
      };
    }

    // Check forbidden content
    const hasForbidden = allDetected.some(label =>
      expectations.forbidden.some(f => label.includes(f))
    );

    // Check required content
    const requiredMatches = expectations.required.filter(req =>
      allDetected.some(label => label.includes(req) || req.includes(label))
    );

    const matchRatio = requiredMatches.length / expectations.required.length;

    console.log('Required matches:', requiredMatches);
    console.log('Match ratio:', matchRatio);

    // Strict threshold — need at least 25% match AND no forbidden content
    if (hasForbidden && requiredMatches.length === 0) {
      return {
        isComplete: false,
        confidence: 0.05,
        description: `❌ Wrong photo! AI detected: ${topLabels}. Please take a photo of: ${expectations.description}.`,
      };
    } else if (matchRatio >= 0.25 && !hasForbidden) {
      return {
        isComplete: true,
        confidence: 0.5 + (matchRatio * 0.5),
        description: `✅ AI verified! Detected: ${topLabels}. Chore looks complete!`,
      };
    } else {
      return {
        isComplete: false,
        confidence: 0.2,
        description: `❌ AI couldn't verify chore. Detected: ${topLabels}. Expected: ${expectations.description}. Please retake photo.`,
      };
    }

  } catch (error) {
    console.error('Vision API error:', error);
    return {
      isComplete: false,
      confidence: 0,
      description: 'AI verification failed. Please try again.',
    };
  }
};