require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function transformPrompt(userPrompt) {
  try {
    console.log('\n=== ChatGPT Prompt Log ===');
    console.log('User prompt:', userPrompt);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Ты — эксперт по созданию изображений. Преобразуй запрос на русском языке в ПРОМПТ на английском для FLUX, включив: "
        },
        {
          role: "user",
          content: ` 
                    1. Акцент на лице пользователя («user’s face», «distinct facial features»).  
                    2. Детали: стиль, освещение, фон, атмосфера.  
                    3. Указания по стилю из запроса пользователя.
                    4. Ключевое слово [trigger] в конце.  

                    Пример:
                    «Vibrant scene with detailed lighting. Highlight user’s face and distinct features. Match requested style. [trigger]»  

                    Обработай запрос: «{${userPrompt}}»`
        }
      ],
    });

    const generatedPrompt = completion.choices[0].message.content.trim();
    console.log('ChatGPT response:', generatedPrompt);
    console.log('Использовано токенов:', {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens
      });
    console.log('=== End Log ===\n');

    return generatedPrompt;
  } catch (error) {
    console.error('Ошибка при работе с ChatGPT:', error);
    throw new Error('Не удалось обработать промпт через ChatGPT');
  }
}

module.exports = { transformPrompt }; 