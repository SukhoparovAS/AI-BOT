const TelegramBot = require('node-telegram-bot-api');
const { fal } = require('@fal-ai/client');
const mongoose = require('mongoose');
const fs = require('fs');
const archiver = require('archiver');
const axios = require('axios');
const presets = require('./config/presets');
const { transformPrompt } = require('./services/chatgpt');

require('dotenv').config();

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Схема пользователя
const userSchema = new mongoose.Schema({
  telegramId: Number,
  datasetUrl: String,
  modelUrl: String,
  status: {
    type: String,
    enum: ['new', 'training', 'ready'],
    default: 'new'
  }
});

const User = mongoose.model('User', userSchema);

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ telegramId: chatId });

  if (user && user.status === 'ready') {
    bot.sendMessage(chatId, 'У вас уже есть обученная модель. Выберите стиль для генерации:', {
      reply_markup: presets.keyboard
    });
  } else {
    // Если нет - создаем нового пользователя или обновляем существующего
    await User.findOneAndUpdate(
      { telegramId: chatId },
      { telegramId: chatId },
      { upsert: true }
    );
    bot.sendMessage(chatId, 'Пришлите мне 10 ваших фотографий для создания персональной модели.');
  }
});

// Обработка фотографий
let userPhotos = {};

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ telegramId: chatId });
  
  if (user.status !== 'new') {
    return bot.sendMessage(chatId, 'У вас уже есть обученная модель.');
  }

  if (!userPhotos[chatId]) {
    userPhotos[chatId] = [];
  }

  const photo = msg.photo[msg.photo.length - 1];
  const file = await bot.getFile(photo.file_id);
  
  userPhotos[chatId].push(file.file_path);

  if (userPhotos[chatId].length === 10) {
    bot.sendMessage(chatId, 'Начинаю обработку фотографий...');
    await processPhotos(chatId);
  } else {
    bot.sendMessage(chatId, `Получено ${userPhotos[chatId].length}/10 фотографий`);
  }
});

// Функция обработки фотографий
async function processPhotos(chatId) {
  try {
    // Создаем директорию temp, если она не существует
    if (!fs.existsSync('./temp')) {
      fs.mkdirSync('./temp');
    }

    const zipPath = `./temp/${chatId}.zip`;
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Максимальная компрессия
    });

    archive.pipe(output);

    // Загрузка фотографий и добавление их в архив
    for (let i = 0; i < userPhotos[chatId].length; i++) {
      const response = await axios({
        url: `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${userPhotos[chatId][i]}`,
        responseType: 'stream'
      });
      archive.append(response.data, { name: `photo${i}.jpg` });
    }

    // Ждем завершения создания архива
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.finalize();
    });

    // Загрузка архива
    const fileBuffer = fs.readFileSync(zipPath);
    const blob = new Blob([fileBuffer], { type: 'application/zip' });
    const url = await fal.storage.upload(blob, {
      fileName: `${chatId}.zip`
    });

    // Обновление пользователя в БД
    await User.findOneAndUpdate(
      { telegramId: chatId },
      { datasetUrl: url, status: 'training' }
    );

    // Запуск обучения модели
    const result = await fal.subscribe("fal-ai/flux-lora-portrait-trainer", {
      input: {
        images_data_url: url,
        learning_rate: 0.00009,
        steps: 1000,
        multiresolution_training: true,
        subject_crop: true
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

    // Сохранение URL модели
    await User.findOneAndUpdate(
      { telegramId: chatId },
      { 
        modelUrl: result.data.diffusers_lora_file.url,
        status: 'ready'
      }
    );

    // Очистка временных файлов
    fs.unlinkSync(zipPath);
    delete userPhotos[chatId];

    bot.sendMessage(chatId, 'Модель обучена! Выберите стиль для генерации:', {
      reply_markup: presets.keyboard
    });

  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, 'Произошла ошибка при обработке фотографий.');
  }
}

// Обработка выбора промпта
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ telegramId: chatId });

  if (!user) {
    return bot.sendMessage(chatId, 'Пожалуйста, начните с команды /start');
  }

  if (user.status !== 'ready') return;

  const promptKey = presets.buttonToPrompt[msg.text];
  let prompt = '';
  
  try {
    if (!promptKey) {
      bot.sendMessage(chatId, 'Обрабатываю ваш промпт через ChatGPT...');
      prompt = await transformPrompt(msg.text);
    } else {
      prompt = presets.prompts[promptKey];
    }

    bot.sendMessage(chatId, 'Генерирую изображение...');
    
    const result = await fal.subscribe("fal-ai/flux-lora", {
      input: {
        prompt,
        loras: [{
          path: user.modelUrl,
        }]
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

    bot.sendPhoto(chatId, result.data.images[0].url);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, 'Произошла ошибка при генерации изображения.');
  }
});
