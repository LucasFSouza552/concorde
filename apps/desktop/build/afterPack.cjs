/* afterPack: remove locales do Electron que não usamos (só pt-BR e en-US ficam). */
const fs = require("fs");
const path = require("path");

const KEEP = new Set(["pt-BR.pak", "en-US.pak"]);

module.exports = async function afterPack(context) {
    const localesDir = path.join(context.appOutDir, "locales");
    if (!fs.existsSync(localesDir)) return;

    let freed = 0;
    for (const file of fs.readdirSync(localesDir)) {
        if (file.endsWith(".pak") && !KEEP.has(file)) {
            freed += fs.statSync(path.join(localesDir, file)).size;
            fs.unlinkSync(path.join(localesDir, file));
        }
    }
    console.log(`afterPack: locales removidos, ${Math.round(freed / 1024 / 1024)} MB liberados`);
};
