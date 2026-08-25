#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const AdmZip = require('adm-zip');

const args = process.argv.slice(2);
const command = args[0];
const subArgs = args.slice(1);

function showHelp() {
    console.log(`
FMod SDK Tools
Build date: 25.08.2026
SDK Version: SDK-250826

Доступные команды:
  pack    - Упаковка папки (аргументы: -i <папка> -o <файл>)
  unpack  - Распаковка .fmd (аргументы: -i <файл> -o <папка>)
  makecfg - Создание конфигурации (интерактивно; необязательный аргумент - путь к файлу вывода)
    `);
}

// ---------------------------------------------------------------------------
// pack: упаковка папки мода в .fmd (обычный zip-архив)
// ---------------------------------------------------------------------------
function runPack(cliArgs) {
    function showPackHelp() {
        console.log(`
Использование: fmd-tools pack [опции]

Опции:
  -i, --input <папка>    Путь к папке для упаковки
  -o, --output <файл>    Путь к выходному .fmd файлу
    `);
        process.exit(0);
    }

    let inputDir = '', outputFile = '';
    for (let i = 0; i < cliArgs.length; i++) {
        if (cliArgs[i] === '-i' || cliArgs[i] === '--input') inputDir = cliArgs[i + 1];
        if (cliArgs[i] === '-o' || cliArgs[i] === '--output') outputFile = cliArgs[i + 1];
    }

    if (!inputDir || !outputFile) showPackHelp();

    try {
        const absPath = path.resolve(inputDir);
        if (!fs.existsSync(absPath)) throw new Error(`Папка ${inputDir} не найдена`);

        const zip = new AdmZip();
        zip.addLocalFolder(absPath);
        zip.writeZip(outputFile);
        console.log(`Успешно создано: ${outputFile}`);
    } catch (e) {
        console.error('Ошибка:', e.message);
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// unpack: распаковка .fmd обратно в папку
// ---------------------------------------------------------------------------
function runUnpack(cliArgs) {
    function showUnpackHelp() {
        console.log(`
Использование: fmd-tools unpack [опции]

Опции:
  -i, --input <файл>     Путь к .fmd файлу
  -o, --output <папка>   Папка для распаковки
    `);
        process.exit(0);
    }

    let inputFile = '', outputDir = '';
    for (let i = 0; i < cliArgs.length; i++) {
        if (cliArgs[i] === '-i' || cliArgs[i] === '--input') inputFile = cliArgs[i + 1];
        if (cliArgs[i] === '-o' || cliArgs[i] === '--output') outputDir = cliArgs[i + 1];
    }

    if (!inputFile || !outputDir) showUnpackHelp();

    try {
        const absInput = path.resolve(inputFile);
        if (!fs.existsSync(absInput)) throw new Error(`Файл ${inputFile} не найден`);

        console.log(`Распаковка: ${inputFile} -> ${outputDir}...`);

        const zip = new AdmZip(absInput);
        zip.extractAllTo(outputDir, true); // true = перезаписывать файлы

        console.log('Готово! Файлы успешно извлечены.');
    } catch (e) {
        console.error('Ошибка:', e.message);
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// makecfg: интерактивное создание package.json мода
// ---------------------------------------------------------------------------
function runMakecfg(cliArgs) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const config = {};

    console.log('fmd-makecfg v1.1');
    console.log('Build date: 25.08.2026');

    function ask(question, key) {
        return new Promise((resolve) => {
            rl.question(`${question}: `, (answer) => {
                config[key] = answer;
                resolve();
            });
        });
    }

    async function run() {
        await ask('Название мода', 'name');
        await ask('Версия', 'version');
        await ask('Автор', 'author');
        await ask('Точка входа (main file)', 'main');
        await ask('Минимальная версия игры', 'minVersion');
        await ask('Game ID', 'gameId');

        // Приводим числовые поля к типу Number: движок FMod (fmod-engine/engine.js и main.js
        // текущей версии игры) сравнивает gameId строгим равенством (pkg.gameId === HOST_GAME_ID),
        // поэтому строка "1" из readline не совпадала бы с числом 1 из package.json игры,
        // и мод всегда считался бы несовместимым. Пустое значение оставляем как есть —
        // движок трактует отсутствие gameId как "подходит для любой игры".
        if (config.gameId !== '' && !isNaN(Number(config.gameId))) {
            config.gameId = Number(config.gameId);
        }
        if (config.minVersion !== '' && !isNaN(Number(config.minVersion))) {
            config.minVersion = Number(config.minVersion);
        }

        const outputPath = cliArgs[0] || 'config.json';
        fs.writeFileSync(path.resolve(outputPath), JSON.stringify(config, null, 2));

        console.log(`\nКонфиг успешно создан: ${outputPath}`);
        rl.close();
    }

    run();
}

// ---------------------------------------------------------------------------
// Точка входа
// ---------------------------------------------------------------------------
const commands = {
    pack: runPack,
    unpack: runUnpack,
    makecfg: runMakecfg
};

// 1. Показываем help, если нет команды или вызван хелп
if (!command || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
}

// 2. Проверяем существование команды
if (!commands[command]) {
    console.error(`Ошибка: Команда '${command}' не найдена.`);
    showHelp();
    process.exit(1);
}

// 3. Выполняем команду прямо внутри процесса (без внешних бинарников/spawn)
commands[command](subArgs);
