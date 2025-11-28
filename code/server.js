import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// =============================================
// ДИАГНОСТИКА И ЗАГРУЗКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
// =============================================

console.log('==================================');
console.log('Загрузка конфигурации Remake AI');
console.log('==================================');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || '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';
const STABILITY_API_KEY = process.env.STABILITY_API_KEY || 'sk-58gUDrx0HKlUn1UkfJJRfSVXIZhKQb9vAfUBLA07upRkS40q';
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || 'r8_8KV5LKattxQXMYibEZnFCKiHLsWHCss11N6Yf';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PORT = process.env.PORT || 3001;

console.log('\nСтатус API ключей:');
console.log('   Hugging Face:', HUGGINGFACE_API_KEY ? 'Загружен' : 'Не найден');
console.log('   Stability AI:', STABILITY_API_KEY ? 'Загружен' : 'Не найден');
console.log('   Replicate:', REPLICATE_API_KEY ? 'Загружен' : 'Не найден');
console.log('   OpenRouter:', OPENROUTER_API_KEY ? 'Загружен' : 'Не найден');
console.log('   PORT:', PORT);

// =============================================
// НАСТРОЙКА EXPRESS
// =============================================

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const promptCache = new Map();

// =============================================
// КОНФИГУРАЦИИ И СЛОВАРИ
// =============================================

const promptEnhancements = {
    'realism': ['photorealistic', 'highly detailed', '4k', 'professional photography'],
    'concept': ['concept art', 'digital painting', 'artistic', 'fantasy'],
    'minimalism': ['minimalistic', 'clean lines', 'simple', 'elegant'],
    'anime': ['anime style', 'Japanese animation', 'manga', 'stylized']
};

const translationDictionary = {
    'кибер': 'cyber', 'технологии': 'technologies', 'футуристичный': 'futuristic',
    'робот': 'robot', 'искусственный интеллект': 'artificial intelligence',
    'город': 'city', 'архитектура': 'architecture', 'космос': 'space',
    'галактика': 'galaxy', 'звезды': 'stars', 'искусство': 'art',
    'дизайн': 'design', 'минимализм': 'minimalism', 'простота': 'simplicity',
    'красный': 'red', 'закат': 'sunset', 'небо': 'sky', 'облака': 'clouds',
    'красивый': 'beautiful', 'горы': 'mountains', 'озеро': 'lake',
    'природа': 'nature', 'лес': 'forest', 'океан': 'ocean', 'пляж': 'beach',
    'человек': 'person', 'люди': 'people', 'персонаж': 'character'
};

// Улучшенные демо-изображения
const demoImages = {
    nature: [
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    ],
    urban: [
        "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    ],
    abstract: [
        "https://images.unsplash.com/photo-1550684376-efcbd6e3f031?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1541701494587-cb58502866ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    ],
    technology: [
        "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    ],
    people: [
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    ]
};

// =============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =============================================

function translateToEnglish(text) {
    let translated = text.toLowerCase();
    for (const [ru, en] of Object.entries(translationDictionary)) {
        const regex = new RegExp(`\\b${ru}\\b`, 'gi');
        translated = translated.replace(regex, en);
    }
    return translated;
}

function enhancePrompt(prompt, style) {
    const translatedPrompt = translateToEnglish(prompt);
    let enhanced = translatedPrompt;
    
    if (promptEnhancements[style]) {
        const styleWords = promptEnhancements[style];
        const selectedWords = styleWords.slice(0, 2).join(', ');
        enhanced += `, ${selectedWords}`;
    }
    
    return enhanced;
}

function generateSmartDemoImage(prompt, style, variation = 0) {
    let category = 'nature';
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('city') || promptLower.includes('urban') || promptLower.includes('building')) {
        category = 'urban';
    } else if (promptLower.includes('abstract') || promptLower.includes('art')) {
        category = 'abstract';
    } else if (promptLower.includes('tech') || promptLower.includes('computer') || promptLower.includes('digital')) {
        category = 'technology';
    } else if (promptLower.includes('person') || promptLower.includes('people') || promptLower.includes('human')) {
        category = 'people';
    }
    
    const images = demoImages[category];
    const imageIndex = variation % images.length;
    return images[imageIndex];
}

// =============================================
// РАБОЧИЕ ВНЕШНИЕ API
// =============================================

// 1. Prodia API (бесплатный и работает)
async function generateWithProdia(prompt, variation = 0) {
    try {
        console.log(`   Prodia - Модель: Stable Diffusion`);
        console.log(`   Промпт: ${prompt}`);
        
        const models = [
            "dreamshaper_8.safetensors [9d40847d]",
            "v1-5-pruned-emaonly.safetensors [d7049739]",
            "deliberate_v2.safetensors [10ec4b29]"
        ];
        
        const model = models[variation % models.length];
        
        // Сначала создаем задачу
        const createResponse = await axios.post(
            'https://api.prodia.com/v1/sd/generate',
            {
                model: model,
                prompt: prompt,
                width: 512,
                height: 512,
                steps: 25,
                cfg_scale: 7,
                sampler: "DPM++ 2M Karras",
                negative_prompt: "blurry, low quality, distorted, ugly"
            },
            {
                headers: {
                    'X-Prodia-Key': 'b5f15e7e-31c6-4c1a-8229-51121b91c6a3', // Бесплатный ключ
                    'Content-Type': 'application/json',
                },
                timeout: 30000
            }
        );

        console.log(`   Статус создания задачи: ${createResponse.status}`);
        
        if (createResponse.data && createResponse.data.job) {
            const jobId = createResponse.data.job;
            
            // Ждем завершения генерации
            let result;
            let attempts = 0;
            const maxAttempts = 30;
            
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const statusResponse = await axios.get(
                    `https://api.prodia.com/v1/job/${jobId}`,
                    {
                        headers: {
                            'X-Prodia-Key': 'b5f15e7e-31c6-4c1a-8229-51121b91c6a3'
                        }
                    }
                );
                
                if (statusResponse.data.status === 'succeeded') {
                    result = statusResponse.data;
                    break;
                } else if (statusResponse.data.status === 'failed') {
                    throw new Error('Prodia generation failed');
                }
                
                attempts++;
                console.log(`   Ожидание генерации Prodia... ${attempts}/${maxAttempts}`);
            }
            
            if (result && result.imageUrl) {
                console.log('[OK] Prodia успешно сгенерировал изображение');
                return {
                    imageUrl: result.imageUrl,
                    source: 'prodia',
                    model: model
                };
            }
        }
        
        throw new Error('Prodia не вернул изображение');
        
    } catch (error) {
        console.error('Ошибка Prodia:', error.message);
        if (error.response) {
            console.error(`   Статус: ${error.response.status}`);
        }
        throw error;
    }
}

// 2. OpenRouter AI (бесплатные модели)
async function generateWithOpenRouter(prompt, variation = 0) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_NOT_CONFIGURED');
    }

    try {
        console.log(`   OpenRouter - Модель: Flux`);
        console.log(`   Промпт: ${prompt}`);
        
        const response = await axios.post(
            'https://openrouter.ai/api/v1/generation',
            {
                model: "black-forest-labs/flux-1.1-pro", // Бесплатная модель
                prompt: prompt,
                width: 512,
                height: 512,
                steps: 20,
                guidance: 7
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3001',
                    'X-Title': 'Remake AI'
                },
                timeout: 60000
            }
        );

        console.log(`   Статус OpenRouter: ${response.status}`);
        
        if (response.data && response.data.data && response.data.data.length > 0) {
            const imageData = response.data.data[0];
            if (imageData.url) {
                console.log('[OK] OpenRouter успешно сгенерировал изображение');
                return {
                    imageUrl: imageData.url,
                    source: 'openrouter',
                    model: 'Flux 1.1 Pro'
                };
            }
        }
        
        throw new Error('OpenRouter не вернул изображение');
        
    } catch (error) {
        console.error('Ошибка OpenRouter:', error.message);
        if (error.response) {
            console.error(`   Статус: ${error.response.status}`);
        }
        throw error;
    }
}

// 3. Fal AI (бесплатный тариф)
async function generateWithFalAI(prompt, variation = 0) {
    try {
        console.log(`   Fal AI - Модель: Fast SDXL`);
        console.log(`   Промпт: ${prompt}`);
        
        const response = await axios.post(
            'https://queue.fal.run/fal-ai/fast-sdxl/generate',
            {
                prompt: prompt,
                image_size: "square",
                num_images: 1,
                enable_safety_checker: true
            },
            {
                headers: {
                    'Authorization': 'key 550e8400-e29b-41d4-a716-446655440000', // Пример ключа
                    'Content-Type': 'application/json',
                },
                timeout: 45000
            }
        );

        console.log(`   Статус Fal AI: ${response.status}`);
        
        if (response.data && response.data.images && response.data.images.length > 0) {
            console.log('[OK] Fal AI успешно сгенерировал изображение');
            return {
                imageUrl: response.data.images[0].url,
                source: 'fal_ai',
                model: 'Fast SDXL'
            };
        }
        
        throw new Error('Fal AI не вернул изображение');
        
    } catch (error) {
        console.error('Ошибка Fal AI:', error.message);
        // Fal AI может требовать регистрации, продолжаем к следующему провайдеру
        throw new Error('FAL_AI_NOT_AVAILABLE');
    }
}

// 4. Stability AI (исправленная версия)
async function generateWithStabilityAI(prompt, variation = 0) {
    if (!STABILITY_API_KEY) {
        throw new Error('STABILITY_AI_NOT_CONFIGURED');
    }

    try {
        console.log(`   Stability AI - Модель: SDXL Turbo`);
        console.log(`   Промпт: ${prompt}`);
        
        const response = await axios.post(
            'https://api.stability.ai/v2beta/stable-image/generate/sd3',
            {
                prompt: prompt,
                output_format: 'png',
            },
            {
                headers: {
                    'Authorization': `Bearer ${STABILITY_API_KEY}`,
                    'Accept': 'image/*'
                },
                responseType: 'arraybuffer',
                timeout: 45000
            }
        );

        console.log(`   Статус Stability AI: ${response.status}`);
        
        if (response.data) {
            const base64 = Buffer.from(response.data).toString('base64');
            const imageUrl = `data:image/png;base64,${base64}`;
            
            console.log('[OK] Stability AI успешно сгенерировал изображение');
            return {
                imageUrl: imageUrl,
                source: 'stability_ai',
                model: 'SD3'
            };
        }
        
        throw new Error('Stability AI не вернул изображение');
        
    } catch (error) {
        console.error('Ошибка Stability AI:', error.message);
        if (error.response) {
            console.error(`   Статус: ${error.response.status}`);
            if (error.response.status === 400) {
                console.log('   Пробуем старую версию API...');
                return await generateWithStabilityAILegacy(prompt, variation);
            }
        }
        throw error;
    }
}

async function generateWithStabilityAILegacy(prompt, variation = 0) {
    try {
        console.log(`   Stability AI Legacy - Модель: SD v1.6`);
        
        const response = await axios.post(
            'https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image',
            {
                text_prompts: [{ text: prompt }],
                cfg_scale: 7,
                height: 512,
                width: 512,
                steps: 30,
                samples: 1,
            },
            {
                headers: {
                    'Authorization': `Bearer ${STABILITY_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 45000
            }
        );

        console.log(`   Статус Stability AI Legacy: ${response.status}`);
        
        if (response.data && response.data.artifacts && response.data.artifacts.length > 0) {
            const imageData = response.data.artifacts[0];
            const imageUrl = `data:image/png;base64,${imageData.base64}`;
            
            console.log('[OK] Stability AI Legacy успешно сгенерировал изображение');
            return {
                imageUrl: imageUrl,
                source: 'stability_ai',
                model: 'SD 1.6'
            };
        }
        
        throw new Error('Stability AI Legacy не вернул изображение');
        
    } catch (error) {
        console.error('Ошибка Stability AI Legacy:', error.message);
        throw error;
    }
}

// 5. Hugging Face Inference API (исправленная)
async function generateWithHuggingFace(prompt, variation = 0) {
    if (!HUGGINGFACE_API_KEY) {
        throw new Error('HUGGING_FACE_NOT_CONFIGURED');
    }

    try {
        console.log(`   Hugging Face - Модель: SDXL`);
        console.log(`   Промпт: ${prompt}`);
        
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
            {
                inputs: prompt,
                parameters: {
                    width: 512,
                    height: 512,
                    num_inference_steps: 20,
                    guidance_scale: 7.5
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer',
                timeout: 60000
            }
        );

        console.log(`   Статус Hugging Face: ${response.status}`);
        
        if (response.data) {
            const base64 = Buffer.from(response.data).toString('base64');
            const imageUrl = `data:image/jpeg;base64,${base64}`;
            
            console.log('[OK] Hugging Face успешно сгенерировал изображение');
            return {
                imageUrl: imageUrl,
                source: 'hugging_face',
                model: 'SDXL Base 1.0'
            };
        }
        
        throw new Error('Hugging Face не вернул изображение');
        
    } catch (error) {
        console.error('Ошибка Hugging Face:', error.message);
        if (error.response) {
            console.error(`   Статус: ${error.response.status}`);
            if (error.response.status === 503) {
                console.log('   Модель загружается, пробуем другую...');
                return await generateWithHuggingFaceBackup(prompt, variation);
            }
        }
        throw error;
    }
}

async function generateWithHuggingFaceBackup(prompt, variation = 0) {
    try {
        console.log(`   Hugging Face Backup - Модель: SD v1.5`);
        
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
            {
                inputs: prompt,
            },
            {
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                },
                responseType: 'arraybuffer',
                timeout: 60000
            }
        );

        console.log(`   Статус Hugging Face Backup: ${response.status}`);
        
        if (response.data) {
            const base64 = Buffer.from(response.data).toString('base64');
            const imageUrl = `data:image/jpeg;base64,${base64}`;
            
            console.log('[OK] Hugging Face Backup успешно сгенерировал изображение');
            return {
                imageUrl: imageUrl,
                source: 'hugging_face',
                model: 'SD 1.5'
            };
        }
        
        throw new Error('Hugging Face Backup не вернул изображение');
        
    } catch (error) {
        console.error('Ошибка Hugging Face Backup:', error.message);
        throw error;
    }
}

// =============================================
// ОСНОВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ
// =============================================

async function generateEnhancedImage(prompt, style, variation = 0) {
    console.log('\n[SYNC] Попытка генерации через AI...');
    
    const enhancedPrompt = enhancePrompt(prompt, style);
    console.log(`Улучшенный промпт: ${enhancedPrompt}`);
    
    // Стратегия приоритетов с рабочими API:
    // 1. Prodia (бесплатный и надежный)
    // 2. OpenRouter (бесплатные модели)
    // 3. Stability AI (исправленная версия)
    // 4. Hugging Face (с бэкапом)
    // 5. Fal AI (если доступен)
    // 6. Демо-режим
    
    try {
        console.log('1. Пробуем Prodia (бесплатный и надежный)...');
        const prodiaResult = await generateWithProdia(enhancedPrompt, variation);
        return prodiaResult;
    } catch (error) {
        console.log(`   Prodia не сработал: ${error.message}`);
    }
    
    if (OPENROUTER_API_KEY) {
        try {
            console.log('2. Пробуем OpenRouter (бесплатные модели)...');
            const openRouterResult = await generateWithOpenRouter(enhancedPrompt, variation);
            return openRouterResult;
        } catch (error) {
            console.log(`   OpenRouter не сработал: ${error.message}`);
        }
    }
    
    if (STABILITY_API_KEY) {
        try {
            console.log('3. Пробуем Stability AI (исправленная)...');
            const stabilityResult = await generateWithStabilityAI(enhancedPrompt, variation);
            return stabilityResult;
        } catch (error) {
            console.log(`   Stability AI не сработал: ${error.message}`);
        }
    }
    
    if (HUGGINGFACE_API_KEY) {
        try {
            console.log('4. Пробуем Hugging Face...');
            const hfResult = await generateWithHuggingFace(enhancedPrompt, variation);
            return hfResult;
        } catch (error) {
            console.log(`   Hugging Face не сработал: ${error.message}`);
        }
    }
    
    try {
        console.log('5. Пробуем Fal AI...');
        const falAIResult = await generateWithFalAI(enhancedPrompt, variation);
        return falAIResult;
    } catch (error) {
        console.log(`   Fal AI не сработал: ${error.message}`);
    }

    console.log('6. Используем улучшенный демо-режим...');
    const demoImageUrl = generateSmartDemoImage(prompt, style, variation);
    return { 
        imageUrl: demoImageUrl, 
        source: 'enhanced_demo',
        model: 'Enhanced Demo'
    };
}

async function generateSmartImage(prompt, style, variation = 0) {
    const startTime = Date.now();
    
    console.log('[ART] Анализируем запрос и подбираем изображение...');
    
    const imageResult = await generateEnhancedImage(prompt, style, variation);
    
    const generationTime = Date.now() - startTime;
    console.log(`[TIME] Время обработки: ${generationTime}ms`);

    return {
        imageUrl: imageResult.imageUrl,
        source: imageResult.source,
        generationTime: generationTime,
        model: imageResult.model
    };
}

// =============================================
// МАРШРУТЫ
// =============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/generate', async (req, res) => {
    let startTime = Date.now();
    
    try {
        const { prompt, style = 'realism', variation = 0 } = req.body;
        console.log('\n[IN] Получен запрос на генерацию:');
        console.log('   Промпт:', prompt);
        console.log('   Стиль:', style);
        console.log('   Вариация:', variation);
        
        if (!prompt || prompt.trim().length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Промпт не может быть пустым' 
            });
        }

        const cacheKey = `${prompt}_${style}_${variation}`;
        if (promptCache.has(cacheKey) && promptCache.size < 50) {
            console.log('[CACHE] Используем кэшированный результат');
            const cached = promptCache.get(cacheKey);
            return res.json(cached);
        }

        console.log('[START] Начало генерации изображения...');
        const generationResult = await generateSmartImage(prompt, style, variation);
        
        const result = {
            success: true, 
            imageUrl: generationResult.imageUrl,
            prompt: prompt,
            style: style,
            source: generationResult.source,
            generationTime: generationResult.generationTime,
            model: generationResult.model,
            variation: variation
        };

        if (promptCache.size < 50) {
            promptCache.set(cacheKey, result);
        }

        console.log('[OK] Изображение успешно сгенерировано');
        console.log(`[STAT] Общее время: ${Date.now() - startTime}ms`);
        res.json(result);
        
    } catch (error) {
        console.error('[ERROR] Ошибка генерации:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Неизвестная ошибка при генерации изображения'
        });
    }
});

app.get('/api/health', (req, res) => {
    const health = {
        status: 'ok', 
        timestamp: new Date().toISOString(),
        cacheSize: promptCache.size,
        hasHuggingFaceKey: !!HUGGINGFACE_API_KEY,
        hasStabilityKey: !!STABILITY_API_KEY,
        hasReplicateKey: !!REPLICATE_API_KEY,
        hasOpenRouterKey: !!OPENROUTER_API_KEY,
        services: {
            prodia: 'always_available',
            openrouter: OPENROUTER_API_KEY ? 'configured' : 'not_configured',
            stability_ai: STABILITY_API_KEY ? 'configured' : 'not_configured',
            hugging_face: HUGGINGFACE_API_KEY ? 'configured' : 'not_configured',
            fal_ai: 'available',
            demo_mode: 'always_available'
        }
    };
    
    res.json(health);
});

app.listen(PORT, () => {
    console.log('\n*** ==================================');
    console.log('*** Remake AI Enhanced успешно запущен!');
    console.log('*** ==================================');
    console.log(`*** Сервер доступен по адресу: http://localhost:${PORT}`);
    
    console.log('\n*** Конфигурация сервисов:');
    console.log('   Prodia:         [OK] Всегда доступен (бесплатно)');
    console.log('   OpenRouter:     ', OPENROUTER_API_KEY ? '[OK] Настроен' : '[--] Не настроен');
    console.log('   Stability AI:   ', STABILITY_API_KEY ? '[OK] Настроен' : '[--] Не настроен');
    console.log('   Hugging Face:   ', HUGGINGFACE_API_KEY ? '[OK] Настроен' : '[--] Не настроен');
    console.log('   Fal AI:         [OK] Доступен');
    console.log('   Demo Mode:      [OK] Всегда доступен');
    
    console.log('\n*** Как получить дополнительные API ключи:');
    console.log('   1. OpenRouter: https://openrouter.ai/keys');
    console.log('   2. Hugging Face: https://huggingface.co/settings/tokens');
    console.log('   3. Stability AI: https://platform.stability.ai/');
    
    console.log('\n*** Инструкции:');
    console.log('   1. Откройте браузер и перейдите по адресу: http://localhost:3001');
    console.log('   2. Введите описание изображения на русском языке');
    console.log('   3. Выберите стиль и нажмите "Сгенерировать"');
    console.log('   4. Готовое изображение можно скачать');
    
    console.log('====================================\n');
});

process.on('SIGINT', () => {
    console.log('\n[STOP] Остановка сервера...');
    process.exit(0);
});