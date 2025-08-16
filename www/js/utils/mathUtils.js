/**
 * Verilen doğru bir LaTeX cevabından, yaygın hata türlerini taklit ederek
 * inandırıcı bir yanlış cevap üretir.
 * @param {string} correctAnswer Doğru LaTeX cevabı.
 * @param {number} index Farklı türde hatalar üretmek için kullanılabilen bir indeks.
 * @returns {string} Üretilen hatalı LaTeX ifadesi.
 */
export function generateWrongAnswer(correctAnswer, index = 0) {
    if (!correctAnswer || typeof correctAnswer !== 'string') return '\\text{Hatalı İşlem}';

    let wrongAnswer = correctAnswer;
    const manipulations = [
        // Sayıları 1 artır veya azalt
        (latex) => latex.replace(/(\d+)/g, (match) => {
            const num = parseInt(match);
            return (num > 1) ? num + 1 : num + 2;
        }),
        // İşaret değiştirme
        (latex) => {
            if (latex.includes('+')) return latex.replace('+', '-');
            if (latex.includes('-')) return latex.replace('-', '+');
            return null;
        },
        // Çarpma/Bölme değiştirme
        (latex) => {
            if (latex.includes('*') || latex.includes('\\times')) return latex.replace(/(\*|\\times)/g, '/');
            if (latex.includes('/')) return latex.replace('/', '*');
            return null;
        },
        // Eşittir'i Eşit Değil yapma
        (latex) => latex.replace('=', '\\neq')
    ];

    for (let i = 0; i < manipulations.length; i++) {
        const currentManipulation = manipulations[(index + i) % manipulations.length];
        const result = currentManipulation(correctAnswer);

        if (result && result !== correctAnswer) {
            wrongAnswer = result;
            break;
        }
    }

    if (wrongAnswer === correctAnswer) {
        if (correctAnswer.includes('=')) {
            const parts = correctAnswer.split('=');
            wrongAnswer = `${parts[0].trim()} = ${parts[1].trim()} + 1`;
        } else {
            wrongAnswer = `${correctAnswer} + 1`;
        }
    }

    return wrongAnswer;
}