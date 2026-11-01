/** Corta ao centro, reduz para `size`px e devolve JPEG dataURL (~15-60KB). */
export async function fileToCompressedDataUrl(file: File, size = 256, quality = 0.85): Promise<string> {
    if (!file.type.startsWith("image/")) {
        throw new Error("Selecione um arquivo de imagem.");
    }

    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error("Imagem inválida."));
            el.src = objectUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Não foi possível processar a imagem.");
        }

        const side = Math.min(image.width, image.height);
        context.drawImage(
            image,
            (image.width - side) / 2,
            (image.height - side) / 2,
            side,
            side,
            0,
            0,
            size,
            size
        );

        return canvas.toDataURL("image/jpeg", quality);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
