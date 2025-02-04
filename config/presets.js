const presets = {
  prompts: {
    business: "A professional [trigger] portrait, wearing a formal business suit, high-end corporate headshot style, professional lighting, clean background",
    clown: "A colorful [trigger] portrait as a circus clown, wearing traditional clown makeup, red nose, colorful wig, circus environment, cheerful expression",
    ufc: "A dynamic [trigger] portrait as a UFC fighter, wearing MMA gloves and shorts, muscular build, intense expression, fighting stance, octagon cage background, dramatic sports lighting, battle-ready pose",
    superhero: "An epic [trigger] portrait as a superhero, wearing a dramatic superhero costume with cape, muscular physique, heroic pose, city skyline background, dynamic lighting, special effects, comic book style, powerful stance"
  },
  
  keyboard: {
    keyboard: [
      ['Деловой портрет'],
      ['Клоун'],
      ['UFC боец'],
      ['Супергерой']
    ],
    resize_keyboard: true
  },

  // Маппинг русских названий кнопок к ключам промптов
  buttonToPrompt: {
    'Деловой портрет': 'business',
    'Клоун': 'clown',
    'UFC боец': 'ufc',
    'Супергерой': 'superhero'
  }
};

module.exports = presets; 